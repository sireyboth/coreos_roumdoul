<?php

namespace App\Services\Payroll;

use Symfony\Component\ExpressionLanguage\ExpressionFunction;
use Symfony\Component\ExpressionLanguage\ExpressionLanguage;
use Symfony\Component\ExpressionLanguage\SyntaxError;

/**
 * The one evaluator every pay rule runs through: templates compile to a
 * formula, and Advanced payroll will let companies write one directly.
 *
 * Safe by construction: arithmetic, comparisons, `a ? b : c` and a short
 * list of maths functions over plain numbers — no PHP eval, no constants or
 * enums (ExpressionLanguage's own extras are left out), no objects.
 */
final class PayFormula
{
    private const FUNCTIONS = ['min', 'max', 'floor', 'ceil', 'round', 'abs'];

    private readonly ExpressionLanguage $language;

    public function __construct()
    {
        $this->language = new class extends ExpressionLanguage
        {
            protected function registerFunctions(): void
            {
                // Deliberately empty: only the functions added below exist.
            }
        };

        foreach (self::FUNCTIONS as $function) {
            $this->language->addFunction(ExpressionFunction::fromPhp($function));
        }
    }

    /** @param  array<string, int|float>  $variables */
    public function evaluate(string $formula, array $variables): float
    {
        return (float) $this->language->evaluate($formula, $variables);
    }

    /**
     * Throws InvalidFormula when the formula doesn't parse or uses a name
     * that isn't one of $variables.
     *
     * @param  array<int, string>  $variables
     */
    public function validate(string $formula, array $variables): void
    {
        try {
            $this->language->lint($formula, $variables);
        } catch (SyntaxError $e) {
            throw new InvalidFormula($e->getMessage(), previous: $e);
        }
    }
}
