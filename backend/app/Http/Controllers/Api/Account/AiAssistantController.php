<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\CompanyMembership;
use App\Services\Ai\AssistantService;
use App\Services\CompanyProvisioner;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Throwable;

class AiAssistantController extends Controller
{
    /** The module a plan must include for its companies to use the assistant. */
    public const MODULE = 'ai_assistant';

    /** Daily limits. All companies share one API budget, so keep these modest. */
    private const PER_COMPANY_PER_DAY = 200;
    private const PER_USER_PER_DAY = 30;

    /** Questions in one chat before a new chat is needed. Matches the chat's QUESTIONS_PER_CHAT. */
    private const QUESTIONS_PER_CHAT = 10;

    public function ask(Request $request, AssistantService $assistant): JsonResponse
    {
        $data = $request->validate([
            'question' => ['required', 'string', 'max:1000'],
            // Each earlier question comes with its answer: two entries apiece.
            'history' => ['sometimes', 'array', 'max:'.((self::QUESTIONS_PER_CHAT - 1) * 2)],
            'history.*.role' => ['required_with:history', 'in:user,assistant'],
            'history.*.content' => ['required_with:history', 'string', 'max:4000'],
        ]);

        $membership = $request->user()->membership;

        // A user without a company (e.g. a platform admin) has no shared
        // budget to count against, so they can't use the assistant here.
        if (! $membership) {
            return response()->json(['message' => __('The help assistant is only available inside a company.')], 403);
        }

        // Every question costs real API credit, so only paying companies get
        // it: a trial is refused even when its plan includes the module.
        if ($membership->company?->status !== 'active') {
            return response()->json([
                'message' => __('The help assistant is available once your company is on a paid plan.'),
                'code' => 'module_not_enabled',
            ], 403);
        }

        $companyId = $membership->company_id;
        $userId = $request->user()->id;

        $companyKey = "ai-assistant:company:{$companyId}";
        $userKey = "ai-assistant:user:{$companyId}:{$userId}";

        if (RateLimiter::tooManyAttempts($companyKey, self::PER_COMPANY_PER_DAY)
            || RateLimiter::tooManyAttempts($userKey, self::PER_USER_PER_DAY)) {
            return response()->json([
                'message' => __('Daily question limit reached. Try again tomorrow.'),
            ], 429);
        }

        // Counted before asking, so many questions sent at once can't all slip
        // under the limit while the first ones are still waiting for an answer.
        RateLimiter::hit($companyKey, 86400);
        RateLimiter::hit($userKey, 86400);

        try {
            $result = $assistant->ask(
                $data['question'],
                $data['history'] ?? [],
                $this->roleName($membership),
            );
        } catch (Throwable $e) {
            report($e);

            // Count only questions that reached the AI: this one is given back.
            RateLimiter::decrement($companyKey, 86400);
            RateLimiter::decrement($userKey, 86400);

            return response()->json([
                'message' => __('The assistant is not available right now. Try again in a few minutes.'),
            ], 503);
        }

        return response()->json([
            'answer' => $result['answer'],
            'status' => $result['status'],
        ]);
    }

    /**
     * The member's main role code (company-admin, manager, employee or a
     * custom role's code). Used only to tailor answers; it never grants
     * access to anything. With several roles, the broadest built-in one wins.
     */
    private function roleName(CompanyMembership $membership): string
    {
        $codes = $membership->roles()->pluck('code');

        foreach (CompanyProvisioner::ROLES as $code) {
            if ($codes->contains($code)) {
                return $code;
            }
        }

        return (string) ($codes->first() ?? 'employee');
    }
}
