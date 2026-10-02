(globalThis["TURBOPACK"] || (globalThis["TURBOPACK"] = [])).push([typeof document === "object" ? document.currentScript : undefined,
"[project]/src/app/login/page.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>LoginPage
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/navigation.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$login$2d$form$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/login-form.tsx [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature();
"use client";
;
;
;
function LoginPage() {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Suspense"], {
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(LoginPageInner, {}, void 0, false, {
            fileName: "[project]/src/app/login/page.tsx",
            lineNumber: 14,
            columnNumber: 7
        }, this)
    }, void 0, false, {
        fileName: "[project]/src/app/login/page.tsx",
        lineNumber: 13,
        columnNumber: 5
    }, this);
}
_c = LoginPage;
function LoginPageInner() {
    _s();
    const linkedCompany = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useSearchParams"])().get("company")?.trim().toLowerCase() || null;
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$login$2d$form$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["LoginForm"], {
        linkedCompany: linkedCompany
    }, void 0, false, {
        fileName: "[project]/src/app/login/page.tsx",
        lineNumber: 21,
        columnNumber: 10
    }, this);
}
_s(LoginPageInner, "i17OZyQ2N5qlJt2o/K9JeMQiDaI=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useSearchParams"]
    ];
});
_c1 = LoginPageInner;
var _c, _c1;
__turbopack_context__.k.register(_c, "LoginPage");
__turbopack_context__.k.register(_c1, "LoginPageInner");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/components/auth-layout.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "AuthLayout",
    ()=>AuthLayout
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$boxes$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Boxes$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/boxes.mjs [app-client] (ecmascript) <export default as Boxes>");
;
;
function AuthLayout({ children }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "relative flex min-h-screen items-center justify-center overflow-hidden bg-background p-6",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                "aria-hidden": true,
                className: "pointer-events-none absolute inset-0 -z-10",
                style: {
                    backgroundImage: "radial-gradient(circle at 20% 20%, color-mix(in oklch, var(--primary), transparent 88%), transparent 45%), radial-gradient(circle at 80% 0%, color-mix(in oklch, var(--primary), transparent 92%), transparent 40%)"
                }
            }, void 0, false, {
                fileName: "[project]/src/components/auth-layout.tsx",
                lineNumber: 6,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "flex w-full max-w-sm flex-col items-center gap-6",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "flex items-center gap-2.5",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm",
                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$boxes$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Boxes$3e$__["Boxes"], {
                                    className: "size-5"
                                }, void 0, false, {
                                    fileName: "[project]/src/components/auth-layout.tsx",
                                    lineNumber: 17,
                                    columnNumber: 13
                                }, this)
                            }, void 0, false, {
                                fileName: "[project]/src/components/auth-layout.tsx",
                                lineNumber: 16,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "text-lg font-semibold tracking-tight",
                                children: "Business OS"
                            }, void 0, false, {
                                fileName: "[project]/src/components/auth-layout.tsx",
                                lineNumber: 19,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/components/auth-layout.tsx",
                        lineNumber: 15,
                        columnNumber: 9
                    }, this),
                    children
                ]
            }, void 0, true, {
                fileName: "[project]/src/components/auth-layout.tsx",
                lineNumber: 14,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/src/components/auth-layout.tsx",
        lineNumber: 5,
        columnNumber: 5
    }, this);
}
_c = AuthLayout;
var _c;
__turbopack_context__.k.register(_c, "AuthLayout");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/components/login-form.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "LoginForm",
    ()=>LoginForm
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/navigation.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/client/app-dir/link.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$auth$2d$layout$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/auth-layout.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$button$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/ui/button.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$input$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/ui/input.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$label$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/ui/label.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$card$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/ui/card.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/api.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$alert$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/ui/alert.tsx [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature();
"use client";
;
;
;
;
;
;
;
;
;
;
function LoginForm({ linkedCompany = null }) {
    _s();
    const router = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRouter"])();
    // Either an email, or a company code + employee ID. A company link means the latter.
    const [method, setMethod] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(linkedCompany ? "employee_id" : "email");
    const [email, setEmail] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])("");
    const [typedCompany, setTypedCompany] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])("");
    const company = linkedCompany ?? typedCompany;
    const [employeeId, setEmployeeId] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])("");
    const [password, setPassword] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])("");
    const [error, setError] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const [loading, setLoading] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    async function handleSubmit(e) {
        e.preventDefault();
        setError(null);
        setLoading(true);
        try {
            const { token } = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["api"].login(method === "email" ? {
                email,
                password
            } : {
                company,
                employee_id: employeeId,
                password
            });
            (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["setToken"])(token);
            router.push("/dashboard");
        } catch (err) {
            setError(err instanceof __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["ApiError"] ? err.message : "Something went wrong.");
        } finally{
            setLoading(false);
        }
    }
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$auth$2d$layout$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["AuthLayout"], {
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$card$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Card"], {
            className: "w-full",
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$card$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["CardHeader"], {
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$card$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["CardTitle"], {
                            className: "text-xl",
                            children: "Sign in"
                        }, void 0, false, {
                            fileName: "[project]/src/components/login-form.tsx",
                            lineNumber: 63,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$card$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["CardDescription"], {
                            children: "Welcome back — sign in with your email or your employee ID."
                        }, void 0, false, {
                            fileName: "[project]/src/components/login-form.tsx",
                            lineNumber: 64,
                            columnNumber: 11
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/src/components/login-form.tsx",
                    lineNumber: 62,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$card$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["CardContent"], {
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("form", {
                            onSubmit: handleSubmit,
                            className: "flex flex-col gap-4",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "grid grid-cols-2 gap-1 rounded-lg bg-muted p-1 text-sm font-medium",
                                    role: "tablist",
                                    children: [
                                        {
                                            id: "email",
                                            label: "Email"
                                        },
                                        {
                                            id: "employee_id",
                                            label: "Employee ID"
                                        }
                                    ].map((tab)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                            type: "button",
                                            role: "tab",
                                            "aria-selected": method === tab.id,
                                            onClick: ()=>{
                                                setMethod(tab.id);
                                                setError(null);
                                            },
                                            className: `rounded-md px-3 py-1.5 transition-colors ${method === tab.id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`,
                                            children: tab.label
                                        }, tab.id, false, {
                                            fileName: "[project]/src/components/login-form.tsx",
                                            lineNumber: 75,
                                            columnNumber: 17
                                        }, this))
                                }, void 0, false, {
                                    fileName: "[project]/src/components/login-form.tsx",
                                    lineNumber: 68,
                                    columnNumber: 13
                                }, this),
                                method === "email" ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "flex flex-col gap-2",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$label$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Label"], {
                                            htmlFor: "email",
                                            children: "Email"
                                        }, void 0, false, {
                                            fileName: "[project]/src/components/login-form.tsx",
                                            lineNumber: 95,
                                            columnNumber: 17
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$input$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Input"], {
                                            id: "email",
                                            type: "email",
                                            required: true,
                                            value: email,
                                            onChange: (e)=>setEmail(e.target.value),
                                            autoComplete: "email"
                                        }, void 0, false, {
                                            fileName: "[project]/src/components/login-form.tsx",
                                            lineNumber: 96,
                                            columnNumber: 17
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/src/components/login-form.tsx",
                                    lineNumber: 94,
                                    columnNumber: 15
                                }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
                                    children: [
                                        linkedCompany ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                            className: "text-sm text-muted-foreground",
                                            children: [
                                                "Signing in to ",
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("strong", {
                                                    className: "text-foreground",
                                                    children: linkedCompany
                                                }, void 0, false, {
                                                    fileName: "[project]/src/components/login-form.tsx",
                                                    lineNumber: 109,
                                                    columnNumber: 35
                                                }, this),
                                                ".",
                                                " ",
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
                                                    href: "/login",
                                                    className: "font-medium text-primary hover:underline",
                                                    children: "Not your company?"
                                                }, void 0, false, {
                                                    fileName: "[project]/src/components/login-form.tsx",
                                                    lineNumber: 110,
                                                    columnNumber: 21
                                                }, this)
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/src/components/login-form.tsx",
                                            lineNumber: 108,
                                            columnNumber: 19
                                        }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "flex flex-col gap-2",
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$label$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Label"], {
                                                    htmlFor: "company",
                                                    children: "Company code"
                                                }, void 0, false, {
                                                    fileName: "[project]/src/components/login-form.tsx",
                                                    lineNumber: 116,
                                                    columnNumber: 21
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$input$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Input"], {
                                                    id: "company",
                                                    required: true,
                                                    placeholder: "e.g. acme-x9k2",
                                                    value: company,
                                                    onChange: (e)=>setTypedCompany(e.target.value),
                                                    autoCapitalize: "none",
                                                    autoCorrect: "off",
                                                    spellCheck: false
                                                }, void 0, false, {
                                                    fileName: "[project]/src/components/login-form.tsx",
                                                    lineNumber: 117,
                                                    columnNumber: 21
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                    className: "text-xs text-muted-foreground",
                                                    children: "Your manager can tell you this."
                                                }, void 0, false, {
                                                    fileName: "[project]/src/components/login-form.tsx",
                                                    lineNumber: 127,
                                                    columnNumber: 21
                                                }, this)
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/src/components/login-form.tsx",
                                            lineNumber: 115,
                                            columnNumber: 19
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "flex flex-col gap-2",
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$label$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Label"], {
                                                    htmlFor: "employee_id",
                                                    children: "Employee ID"
                                                }, void 0, false, {
                                                    fileName: "[project]/src/components/login-form.tsx",
                                                    lineNumber: 131,
                                                    columnNumber: 19
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$input$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Input"], {
                                                    id: "employee_id",
                                                    required: true,
                                                    placeholder: "e.g. E-001",
                                                    value: employeeId,
                                                    onChange: (e)=>setEmployeeId(e.target.value),
                                                    autoComplete: "username",
                                                    autoCapitalize: "none",
                                                    autoCorrect: "off",
                                                    spellCheck: false
                                                }, void 0, false, {
                                                    fileName: "[project]/src/components/login-form.tsx",
                                                    lineNumber: 132,
                                                    columnNumber: 19
                                                }, this)
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/src/components/login-form.tsx",
                                            lineNumber: 130,
                                            columnNumber: 17
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/src/components/login-form.tsx",
                                    lineNumber: 106,
                                    columnNumber: 15
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "flex flex-col gap-2",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$label$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Label"], {
                                            htmlFor: "password",
                                            children: "Password"
                                        }, void 0, false, {
                                            fileName: "[project]/src/components/login-form.tsx",
                                            lineNumber: 147,
                                            columnNumber: 15
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$input$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Input"], {
                                            id: "password",
                                            type: "password",
                                            required: true,
                                            value: password,
                                            onChange: (e)=>setPassword(e.target.value),
                                            autoComplete: "current-password"
                                        }, void 0, false, {
                                            fileName: "[project]/src/components/login-form.tsx",
                                            lineNumber: 148,
                                            columnNumber: 15
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/src/components/login-form.tsx",
                                    lineNumber: 146,
                                    columnNumber: 13
                                }, this),
                                error && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$alert$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Alert"], {
                                    variant: "destructive",
                                    children: error
                                }, void 0, false, {
                                    fileName: "[project]/src/components/login-form.tsx",
                                    lineNumber: 157,
                                    columnNumber: 23
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$button$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                                    type: "submit",
                                    disabled: loading,
                                    className: "mt-1",
                                    children: loading ? "Signing in…" : "Sign in"
                                }, void 0, false, {
                                    fileName: "[project]/src/components/login-form.tsx",
                                    lineNumber: 158,
                                    columnNumber: 13
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/src/components/login-form.tsx",
                            lineNumber: 67,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                            className: "mt-5 text-center text-sm text-muted-foreground",
                            children: [
                                "Don't have an account?",
                                " ",
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
                                    href: "/signup",
                                    className: "font-medium text-primary hover:underline",
                                    children: "Create one"
                                }, void 0, false, {
                                    fileName: "[project]/src/components/login-form.tsx",
                                    lineNumber: 164,
                                    columnNumber: 13
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/src/components/login-form.tsx",
                            lineNumber: 162,
                            columnNumber: 11
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/src/components/login-form.tsx",
                    lineNumber: 66,
                    columnNumber: 9
                }, this)
            ]
        }, void 0, true, {
            fileName: "[project]/src/components/login-form.tsx",
            lineNumber: 61,
            columnNumber: 7
        }, this)
    }, void 0, false, {
        fileName: "[project]/src/components/login-form.tsx",
        lineNumber: 60,
        columnNumber: 5
    }, this);
}
_s(LoginForm, "VWvP1ySFqSHZZS8zDAxn+1jhidw=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRouter"]
    ];
});
_c = LoginForm;
var _c;
__turbopack_context__.k.register(_c, "LoginForm");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/components/ui/alert.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "Alert",
    ()=>Alert
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$class$2d$variance$2d$authority$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/class-variance-authority/dist/index.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$triangle$2d$alert$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__AlertTriangle$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/triangle-alert.mjs [app-client] (ecmascript) <export default as AlertTriangle>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$circle$2d$check$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__CheckCircle2$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/circle-check.mjs [app-client] (ecmascript) <export default as CheckCircle2>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$info$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Info$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/info.mjs [app-client] (ecmascript) <export default as Info>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$circle$2d$x$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__XCircle$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/circle-x.mjs [app-client] (ecmascript) <export default as XCircle>");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/src/lib/utils.ts [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$cn$2f$dist$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/node_modules/cn/dist/index.js [app-client] (ecmascript) <locals>");
;
;
;
;
const alertVariants = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$class$2d$variance$2d$authority$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cva"])("relative flex w-full items-start gap-3 rounded-xl border p-4 text-sm", {
    variants: {
        variant: {
            info: "border-info/30 bg-info/10 [&_[data-slot=alert-icon]]:text-info",
            success: "border-success/30 bg-success/10 [&_[data-slot=alert-icon]]:text-success",
            warning: "border-warning/40 bg-warning/12 [&_[data-slot=alert-icon]]:text-warning",
            destructive: "border-destructive/30 bg-destructive/10 [&_[data-slot=alert-icon]]:text-destructive"
        }
    },
    defaultVariants: {
        variant: "info"
    }
});
const ICONS = {
    info: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$info$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Info$3e$__["Info"],
    success: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$circle$2d$check$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__CheckCircle2$3e$__["CheckCircle2"],
    warning: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$triangle$2d$alert$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__AlertTriangle$3e$__["AlertTriangle"],
    destructive: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$circle$2d$x$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__XCircle$3e$__["XCircle"]
};
/** A prominent, in-page message — for things the user must not miss. */ function Alert({ variant = "info", title, action, className, children, ...props }) {
    const Icon = ICONS[variant ?? "info"];
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        role: variant === "destructive" || variant === "warning" ? "alert" : "status",
        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$cn$2f$dist$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["cn"])(alertVariants({
            variant
        }), className),
        ...props,
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(Icon, {
                "data-slot": "alert-icon",
                className: "mt-0.5 size-5 shrink-0"
            }, void 0, false, {
                fileName: "[project]/src/components/ui/alert.tsx",
                lineNumber: 45,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "min-w-0 flex-1",
                children: [
                    title && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        className: "font-semibold leading-tight",
                        children: title
                    }, void 0, false, {
                        fileName: "[project]/src/components/ui/alert.tsx",
                        lineNumber: 47,
                        columnNumber: 19
                    }, this),
                    children && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$cn$2f$dist$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["cn"])("text-foreground/80", title && "mt-1"),
                        children: children
                    }, void 0, false, {
                        fileName: "[project]/src/components/ui/alert.tsx",
                        lineNumber: 48,
                        columnNumber: 22
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/src/components/ui/alert.tsx",
                lineNumber: 46,
                columnNumber: 7
            }, this),
            action && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "shrink-0 self-center",
                children: action
            }, void 0, false, {
                fileName: "[project]/src/components/ui/alert.tsx",
                lineNumber: 50,
                columnNumber: 18
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/src/components/ui/alert.tsx",
        lineNumber: 40,
        columnNumber: 5
    }, this);
}
_c = Alert;
;
var _c;
__turbopack_context__.k.register(_c, "Alert");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/components/ui/card.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "Card",
    ()=>Card,
    "CardAction",
    ()=>CardAction,
    "CardContent",
    ()=>CardContent,
    "CardDescription",
    ()=>CardDescription,
    "CardFooter",
    ()=>CardFooter,
    "CardHeader",
    ()=>CardHeader,
    "CardTitle",
    ()=>CardTitle
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$cn$2f$dist$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/node_modules/cn/dist/index.js [app-client] (ecmascript) <locals>");
;
;
function Card({ className, size = "default", ...props }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        "data-slot": "card",
        "data-size": size,
        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$cn$2f$dist$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["cn"])("group/card flex flex-col gap-(--card-spacing) overflow-hidden rounded-xl bg-card py-(--card-spacing) text-sm text-card-foreground shadow-[0_1px_2px_rgb(0_0_0/0.04),0_4px_16px_-8px_rgb(40_30_120/0.12)] ring-1 ring-border [--card-spacing:--spacing(4)] has-data-[slot=card-footer]:pb-0 has-[>img:first-child]:pt-0 data-[size=sm]:[--card-spacing:--spacing(3)] data-[size=sm]:has-data-[slot=card-footer]:pb-0 *:[img:first-child]:rounded-t-xl *:[img:last-child]:rounded-b-xl", className),
        ...props
    }, void 0, false, {
        fileName: "[project]/src/components/ui/card.tsx",
        lineNumber: 10,
        columnNumber: 5
    }, this);
}
_c = Card;
function CardHeader({ className, ...props }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        "data-slot": "card-header",
        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$cn$2f$dist$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["cn"])("group/card-header @container/card-header grid auto-rows-min items-start gap-1 rounded-t-xl px-(--card-spacing) has-data-[slot=card-action]:grid-cols-[1fr_auto] has-data-[slot=card-description]:grid-rows-[auto_auto] [.border-b]:pb-(--card-spacing)", className),
        ...props
    }, void 0, false, {
        fileName: "[project]/src/components/ui/card.tsx",
        lineNumber: 24,
        columnNumber: 5
    }, this);
}
_c1 = CardHeader;
function CardTitle({ className, ...props }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        "data-slot": "card-title",
        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$cn$2f$dist$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["cn"])("font-heading text-base leading-snug font-semibold tracking-tight group-data-[size=sm]/card:text-sm", className),
        ...props
    }, void 0, false, {
        fileName: "[project]/src/components/ui/card.tsx",
        lineNumber: 37,
        columnNumber: 5
    }, this);
}
_c2 = CardTitle;
function CardDescription({ className, ...props }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        "data-slot": "card-description",
        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$cn$2f$dist$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["cn"])("text-sm text-muted-foreground", className),
        ...props
    }, void 0, false, {
        fileName: "[project]/src/components/ui/card.tsx",
        lineNumber: 50,
        columnNumber: 5
    }, this);
}
_c3 = CardDescription;
function CardAction({ className, ...props }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        "data-slot": "card-action",
        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$cn$2f$dist$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["cn"])("col-start-2 row-span-2 row-start-1 self-start justify-self-end", className),
        ...props
    }, void 0, false, {
        fileName: "[project]/src/components/ui/card.tsx",
        lineNumber: 60,
        columnNumber: 5
    }, this);
}
_c4 = CardAction;
function CardContent({ className, ...props }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        "data-slot": "card-content",
        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$cn$2f$dist$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["cn"])("px-(--card-spacing)", className),
        ...props
    }, void 0, false, {
        fileName: "[project]/src/components/ui/card.tsx",
        lineNumber: 73,
        columnNumber: 5
    }, this);
}
_c5 = CardContent;
function CardFooter({ className, ...props }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        "data-slot": "card-footer",
        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$cn$2f$dist$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["cn"])("flex items-center rounded-b-xl border-t bg-muted/50 p-(--card-spacing)", className),
        ...props
    }, void 0, false, {
        fileName: "[project]/src/components/ui/card.tsx",
        lineNumber: 83,
        columnNumber: 5
    }, this);
}
_c6 = CardFooter;
;
var _c, _c1, _c2, _c3, _c4, _c5, _c6;
__turbopack_context__.k.register(_c, "Card");
__turbopack_context__.k.register(_c1, "CardHeader");
__turbopack_context__.k.register(_c2, "CardTitle");
__turbopack_context__.k.register(_c3, "CardDescription");
__turbopack_context__.k.register(_c4, "CardAction");
__turbopack_context__.k.register(_c5, "CardContent");
__turbopack_context__.k.register(_c6, "CardFooter");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/components/ui/input.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "Input",
    ()=>Input
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$base$2d$ui$2f$react$2f$input$2f$Input$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@base-ui/react/input/Input.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$cn$2f$dist$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/node_modules/cn/dist/index.js [app-client] (ecmascript) <locals>");
;
;
;
function Input({ className, type, ...props }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$base$2d$ui$2f$react$2f$input$2f$Input$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Input"], {
        type: type,
        "data-slot": "input",
        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$cn$2f$dist$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["cn"])("h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40", className),
        ...props
    }, void 0, false, {
        fileName: "[project]/src/components/ui/input.tsx",
        lineNumber: 7,
        columnNumber: 5
    }, this);
}
_c = Input;
;
var _c;
__turbopack_context__.k.register(_c, "Input");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/components/ui/label.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "Label",
    ()=>Label
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$cn$2f$dist$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/node_modules/cn/dist/index.js [app-client] (ecmascript) <locals>");
"use client";
;
;
function Label({ className, ...props }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
        "data-slot": "label",
        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$cn$2f$dist$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["cn"])("flex items-center gap-2 text-sm leading-none font-medium select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50", className),
        ...props
    }, void 0, false, {
        fileName: "[project]/src/components/ui/label.tsx",
        lineNumber: 8,
        columnNumber: 5
    }, this);
}
_c = Label;
;
var _c;
__turbopack_context__.k.register(_c, "Label");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/lib/api.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "ACCOUNT_BLOCKED_CODES",
    ()=>ACCOUNT_BLOCKED_CODES,
    "ACCOUNT_BLOCKED_EVENT",
    ()=>ACCOUNT_BLOCKED_EVENT,
    "ApiError",
    ()=>ApiError,
    "api",
    ()=>api,
    "clearToken",
    ()=>clearToken,
    "getMeSnapshot",
    ()=>getMeSnapshot,
    "getToken",
    ()=>getToken,
    "photoSrc",
    ()=>photoSrc,
    "saveMeSnapshot",
    ()=>saveMeSnapshot,
    "setToken",
    ()=>setToken
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$polyfills$2f$process$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = /*#__PURE__*/ __turbopack_context__.i("[project]/node_modules/next/dist/build/polyfills/process.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$http$2d$cache$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/http-cache.ts [app-client] (ecmascript)");
;
const API_URL = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$polyfills$2f$process$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const TOKEN_KEY = "business_os_token";
const ME_SNAPSHOT_KEY = "business_os_me";
// Reference-data lists that many pages ask for again and again. Live data
// (attendance, schedules, the calendar) is deliberately not cached.
const CACHEABLE_GET = /^\/api\/(branches|departments|teams|shifts|work_locations|holidays|employees|roles|permissions|users)(\?|$)/;
const httpCache = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$http$2d$cache$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["createHttpCache"])(30_000);
function getToken() {
    if ("TURBOPACK compile-time falsy", 0) //TURBOPACK unreachable
    ;
    return window.localStorage.getItem(TOKEN_KEY);
}
function setToken(token) {
    window.localStorage.setItem(TOKEN_KEY, token);
    // A fresh sign-in starts clean, even if the previous session wasn't signed out properly.
    httpCache.clear();
}
function clearToken() {
    window.localStorage.removeItem(TOKEN_KEY);
    window.localStorage.removeItem(ME_SNAPSHOT_KEY);
    // Nothing from one person's session may be served to the next.
    httpCache.clear();
}
function getMeSnapshot(token) {
    try {
        const raw = window.localStorage.getItem(ME_SNAPSHOT_KEY);
        const saved = raw ? JSON.parse(raw) : null;
        return saved && saved.token === token ? saved.me : null;
    } catch  {
        return null;
    }
}
function saveMeSnapshot(token, me) {
    try {
        window.localStorage.setItem(ME_SNAPSHOT_KEY, JSON.stringify({
            token,
            me
        }));
    } catch  {
    // storage full or blocked — the snapshot is only an optimisation
    }
}
class ApiError extends Error {
    status;
    errors;
    /** Machine-readable reason, e.g. plan_limit_reached, trial_expired. */ code;
    constructor(status, message, errors, code){
        super(message);
        this.status = status;
        this.errors = errors;
        this.code = code;
    }
}
const ACCOUNT_BLOCKED_CODES = [
    "trial_expired",
    "company_suspended",
    "company_cancelled",
    "company_deleted"
];
const ACCOUNT_BLOCKED_EVENT = "app:account-blocked";
function photoSrc(url) {
    return url ? `${API_URL}${url}` : null;
}
const sleep = (ms)=>new Promise((resolve)=>setTimeout(resolve, ms));
async function request(path, options = {}) {
    const method = (options.method ?? "GET").toUpperCase();
    if (method === "GET") {
        const send = ()=>sendWithRetry(path, options);
        return CACHEABLE_GET.test(path) ? httpCache.get(path, send) : send();
    }
    try {
        return await sendOnce(path, options);
    } finally{
        // Any change (even a failed one) may have altered what the lists show.
        httpCache.clear();
    }
}
/** A dropped connection on a read is worth one more try; a write is never repeated automatically. */ async function sendWithRetry(path, options) {
    try {
        return await sendOnce(path, options);
    } catch (err) {
        if (!(err instanceof ApiError) || err.code !== "network_error") throw err;
        await sleep(800);
        return sendOnce(path, options);
    }
}
async function sendOnce(path, options) {
    const token = getToken();
    let res;
    try {
        res = await fetch(`${API_URL}${path}`, {
            ...options,
            headers: {
                // A FormData body sets its own multipart boundary — forcing JSON would break uploads.
                ...options.body instanceof FormData ? {} : {
                    "Content-Type": "application/json"
                },
                Accept: "application/json",
                ...token ? {
                    Authorization: `Bearer ${token}`
                } : {},
                ...options.headers
            }
        });
    } catch (err) {
        // fetch() rejects with a plain TypeError for anything before a response comes back —
        // the server is down, the URL is wrong, or the network dropped. Left as-is, every
        // caller's catch block shows the generic "Something went wrong.", which is true but
        // useless here: this is the one case where we can name the actual problem.
        if (err instanceof TypeError) {
            throw new ApiError(0, `Can't reach the server at ${API_URL}. It may be offline, or check your internet connection.`, undefined, "network_error");
        }
        throw err;
    }
    if (!res.ok) {
        const body = await res.json().catch(()=>({}));
        if (("TURBOPACK compile-time value", "object") !== "undefined" && ACCOUNT_BLOCKED_CODES.includes(body.code)) {
            window.dispatchEvent(new CustomEvent(ACCOUNT_BLOCKED_EVENT, {
                detail: {
                    code: body.code,
                    message: body.message
                }
            }));
        }
        throw new ApiError(res.status, body.message ?? `Request failed (${res.status})`, body.errors, body.code);
    }
    if (res.status === 204) return undefined;
    return res.json();
}
/**
 * Every row of a paginated list, page by page — for exports, which must never
 * stop at the first 25. Asks for the largest page each endpoint allows.
 */ async function requestAll(path) {
    const join = path.includes("?") ? "&" : "?";
    const first = await request(`${path}${join}page=1`);
    const rows = [
        ...first.data
    ];
    for(let page = 2; page <= (first.last_page ?? 1); page++){
        rows.push(...(await request(`${path}${join}page=${page}`)).data);
    }
    return rows;
}
const api = {
    // Either an email, or a company code + employee ID — never both.
    login: (credentials)=>request("/api/auth/login", {
            method: "POST",
            body: JSON.stringify(credentials)
        }),
    register: (companyName, name, email, password)=>request("/api/auth/register", {
            method: "POST",
            body: JSON.stringify({
                company_name: companyName,
                name,
                email,
                password
            })
        }),
    me: ()=>request("/api/me"),
    logout: ()=>request("/api/auth/logout", {
            method: "POST"
        }),
    branches: {
        list: ()=>request("/api/branches"),
        all: ()=>requestAll("/api/branches"),
        create: (data)=>request("/api/branches", {
                method: "POST",
                body: JSON.stringify(data)
            }),
        update: (id, data)=>request(`/api/branches/${id}`, {
                method: "PUT",
                body: JSON.stringify(data)
            }),
        regenerateQr: (id)=>request(`/api/branches/${id}/regenerate-qr`, {
                method: "POST"
            }),
        remove: (id)=>request(`/api/branches/${id}`, {
                method: "DELETE"
            })
    },
    employees: {
        // Loads up to 500 by default — the API's own default is only 25, which
        // silently hid everyone after the 25th. `total` is the real headcount.
        list: (params = {})=>{
            const query = new URLSearchParams({
                per_page: String(params.perPage ?? 500)
            });
            if (params.departmentId) query.set("department_id", String(params.departmentId));
            if (params.teamId) query.set("team_id", String(params.teamId));
            return request(`/api/employees?${query}`);
        },
        all: ()=>requestAll("/api/employees?per_page=500"),
        get: (id)=>request(`/api/employees/${id}`),
        // Sends the (already resized) image; the server re-encodes it again.
        uploadPhoto: (id, photo)=>{
            const body = new FormData();
            body.append("photo", photo, "photo.jpg");
            return request(`/api/employees/${id}/photo`, {
                method: "POST",
                body
            });
        },
        removePhoto: (id)=>request(`/api/employees/${id}/photo`, {
                method: "DELETE"
            }),
        create: (data)=>request("/api/employees", {
                method: "POST",
                body: JSON.stringify(data)
            }),
        update: (id, data)=>request(`/api/employees/${id}`, {
                method: "PUT",
                body: JSON.stringify(data)
            }),
        remove: (id)=>request(`/api/employees/${id}`, {
                method: "DELETE"
            }),
        createLogin: (id, data)=>request(`/api/employees/${id}/login`, {
                method: "POST",
                body: JSON.stringify(data)
            }),
        // A PDF, not JSON, so it can't go through request() — same reasoning as
        // attendance.export below.
        card: async (id)=>{
            const token = getToken();
            const res = await fetch(`${API_URL}/api/employees/${id}/card`, {
                headers: {
                    Accept: "application/pdf",
                    ...token ? {
                        Authorization: `Bearer ${token}`
                    } : {}
                }
            });
            if (!res.ok) {
                const body = await res.json().catch(()=>({}));
                throw new ApiError(res.status, body.message ?? `Couldn't generate the card (${res.status})`, body.errors, body.code);
            }
            return res.blob();
        }
    },
    users: {
        list: ()=>request("/api/users"),
        invite: (data)=>request("/api/users", {
                method: "POST",
                body: JSON.stringify(data)
            }),
        updateRole: (id, role)=>request(`/api/users/${id}`, {
                method: "PUT",
                body: JSON.stringify({
                    role
                })
            }),
        setActive: (id, is_active)=>request(`/api/users/${id}/active`, {
                method: "PATCH",
                body: JSON.stringify({
                    is_active
                })
            }),
        setBranchAccess: (id, branch_ids)=>request(`/api/users/${id}/branch-access`, {
                method: "PUT",
                body: JSON.stringify({
                    branch_ids
                })
            }),
        remove: (id)=>request(`/api/users/${id}`, {
                method: "DELETE"
            })
    },
    roles: {
        list: ()=>request("/api/roles"),
        permissions: ()=>request("/api/permissions"),
        create: (data)=>request("/api/roles", {
                method: "POST",
                body: JSON.stringify(data)
            }),
        update: (id, data)=>request(`/api/roles/${id}`, {
                method: "PUT",
                body: JSON.stringify(data)
            }),
        remove: (id)=>request(`/api/roles/${id}`, {
                method: "DELETE"
            })
    },
    workLocations: {
        list: ()=>request("/api/work_locations"),
        all: ()=>requestAll("/api/work_locations"),
        create: (data)=>request("/api/work_locations", {
                method: "POST",
                body: JSON.stringify(data)
            }),
        update: (id, data)=>request(`/api/work_locations/${id}`, {
                method: "PUT",
                body: JSON.stringify(data)
            }),
        regenerateQr: (id)=>request(`/api/work_locations/${id}/regenerate-qr`, {
                method: "POST"
            }),
        remove: (id)=>request(`/api/work_locations/${id}`, {
                method: "DELETE"
            })
    },
    // Pass a large perPage to fill a dropdown (the API caps it at 200).
    departments: {
        list: (perPage = 25)=>request(`/api/departments?per_page=${perPage}`),
        all: ()=>requestAll("/api/departments?per_page=200"),
        create: (data)=>request("/api/departments", {
                method: "POST",
                body: JSON.stringify(data)
            }),
        update: (id, data)=>request(`/api/departments/${id}`, {
                method: "PUT",
                body: JSON.stringify(data)
            }),
        remove: (id)=>request(`/api/departments/${id}`, {
                method: "DELETE"
            }),
        addMembers: (id, employeeIds)=>request(`/api/departments/${id}/members`, {
                method: "POST",
                body: JSON.stringify({
                    employee_ids: employeeIds
                })
            }),
        removeMember: (id, employeeId)=>request(`/api/departments/${id}/members/${employeeId}`, {
                method: "DELETE"
            })
    },
    teams: {
        list: (perPage = 25)=>request(`/api/teams?per_page=${perPage}`),
        all: ()=>requestAll("/api/teams?per_page=200"),
        create: (data)=>request("/api/teams", {
                method: "POST",
                body: JSON.stringify(data)
            }),
        update: (id, data)=>request(`/api/teams/${id}`, {
                method: "PUT",
                body: JSON.stringify(data)
            }),
        remove: (id)=>request(`/api/teams/${id}`, {
                method: "DELETE"
            }),
        addMembers: (id, employeeIds)=>request(`/api/teams/${id}/members`, {
                method: "POST",
                body: JSON.stringify({
                    employee_ids: employeeIds
                })
            }),
        removeMember: (id, employeeId)=>request(`/api/teams/${id}/members/${employeeId}`, {
                method: "DELETE"
            })
    },
    workSchedules: {
        // Not paginated: a company has a handful of schedules.
        list: ()=>request("/api/work_schedules"),
        get: (id)=>request(`/api/work_schedules/${id}`),
        create: (data)=>request("/api/work_schedules", {
                method: "POST",
                body: JSON.stringify(data)
            }),
        // Sending `days` replaces every day's slots; leave it out to keep them.
        update: (id, data)=>request(`/api/work_schedules/${id}`, {
                method: "PUT",
                body: JSON.stringify(data)
            }),
        remove: (id)=>request(`/api/work_schedules/${id}`, {
                method: "DELETE"
            })
    },
    scheduleAssignments: {
        list: (params = {})=>{
            const query = new URLSearchParams();
            if (params.employeeId) query.set("employee_id", String(params.employeeId));
            if (params.workScheduleId) query.set("work_schedule_id", String(params.workScheduleId));
            if (params.currentOnly) query.set("current_only", "1");
            return request(`/api/schedule-assignments${query.size ? `?${query}` : ""}`);
        },
        create: (data)=>request("/api/schedule-assignments", {
                method: "POST",
                body: JSON.stringify(data)
            }),
        // Each person is handled on their own; anyone who can't take it is listed in `skipped`.
        bulk: (data)=>request("/api/schedule-assignments/bulk", {
                method: "POST",
                body: JSON.stringify(data)
            }),
        update: (id, data)=>request(`/api/schedule-assignments/${id}`, {
                method: "PUT",
                body: JSON.stringify(data)
            }),
        remove: (id)=>request(`/api/schedule-assignments/${id}`, {
                method: "DELETE"
            })
    },
    holidays: {
        list: ()=>request("/api/holidays"),
        all: ()=>requestAll("/api/holidays"),
        create: (data)=>request("/api/holidays", {
                method: "POST",
                body: JSON.stringify(data)
            }),
        update: (id, data)=>request(`/api/holidays/${id}`, {
                method: "PUT",
                body: JSON.stringify(data)
            }),
        remove: (id)=>request(`/api/holidays/${id}`, {
                method: "DELETE"
            }),
        import: (holidays)=>request("/api/holidays/import", {
                method: "POST",
                body: JSON.stringify({
                    holidays
                })
            })
    },
    calendar: {
        team: (month, branchId)=>request(`/api/calendar/team?month=${month}${branchId ? `&branch_id=${branchId}` : ""}`),
        month: (month, employeeId)=>request(`/api/calendar?month=${month}${employeeId ? `&employee_id=${employeeId}` : ""}`)
    },
    daysOff: {
        create: (data)=>request("/api/days-off", {
                method: "POST",
                body: JSON.stringify(data)
            }),
        remove: (id)=>request(`/api/days-off/${id}`, {
                method: "DELETE"
            })
    },
    schedules: {
        // Ask for a date range: the API pages 50 at a time unless perPage is raised (max 2000).
        list: (params = {})=>{
            const query = new URLSearchParams({
                per_page: String(params.perPage ?? 2000)
            });
            if (params.employeeId) query.set("employee_id", String(params.employeeId));
            if (params.from) query.set("from", params.from);
            if (params.to) query.set("to", params.to);
            return request(`/api/schedules?${query}`);
        },
        all: (params)=>{
            const query = new URLSearchParams({
                per_page: "2000",
                from: params.from,
                to: params.to
            });
            if (params.employeeId) query.set("employee_id", String(params.employeeId));
            return requestAll(`/api/schedules?${query}`);
        },
        // Rosters many people over a date range in one go. dry_run only reports what it would do.
        bulk: (data)=>request("/api/schedules/bulk", {
                method: "POST",
                body: JSON.stringify(data)
            }),
        create: (data)=>request("/api/schedules", {
                method: "POST",
                body: JSON.stringify(data)
            }),
        update: (id, data)=>request(`/api/schedules/${id}`, {
                method: "PUT",
                body: JSON.stringify(data)
            }),
        remove: (id)=>request(`/api/schedules/${id}`, {
                method: "DELETE"
            })
    },
    dashboard: {
        summary: ()=>request("/api/dashboard/summary")
    },
    attendance: {
        // The API sends 50 rows unless asked for more (max 1000) — say so, or a busy
        // company's list silently stops after the newest 50.
        list: (params)=>{
            const query = new URLSearchParams(Object.entries(params ?? {}).filter(([, v])=>v !== undefined && v !== "").map(([k, v])=>[
                    k,
                    String(v)
                ])).toString();
            return request(`/api/attendance${query ? `?${query}` : ""}`);
        },
        // One scan: the person's schedule decides whether it's an IN or an OUT.
        scan: (data)=>request("/api/attendance/scan", {
                method: "POST",
                body: JSON.stringify(data ?? {})
            }),
        today: ()=>request("/api/attendance/today"),
        overtime: (params = {})=>{
            const query = new URLSearchParams(Object.entries(params).filter(([, v])=>v));
            return request(`/api/attendance/overtime${query.size ? `?${query}` : ""}`);
        },
        approveOvertime: (dayId)=>request(`/api/attendance/days/${dayId}/overtime/approve`, {
                method: "POST",
                body: "{}"
            }),
        rejectOvertime: (dayId)=>request(`/api/attendance/days/${dayId}/overtime/reject`, {
                method: "POST",
                body: "{}"
            }),
        summary: (month, employeeId)=>request(`/api/attendance/summary?month=${month}${employeeId ? `&employee_id=${employeeId}` : ""}`),
        periods: ()=>request("/api/attendance/periods"),
        // ignorePendingOvertime: lock even though some overtime was never reviewed (it won't be paid).
        lockMonth: (month, ignorePendingOvertime = false)=>request("/api/attendance/periods", {
                method: "POST",
                body: JSON.stringify({
                    month,
                    ignore_pending_overtime: ignorePendingOvertime
                })
            }),
        unlockMonth: (month)=>request(`/api/attendance/periods/${month}`, {
                method: "DELETE"
            }),
        // The report is a file, not JSON, so it can't go through request(). It still
        // needs the login header, which is why a plain <a href> can't be used either.
        export: async (params)=>{
            const query = new URLSearchParams({
                from: params.from,
                to: params.to
            });
            if (params.employee_id) query.set("employee_id", String(params.employee_id));
            const token = getToken();
            const res = await fetch(`${API_URL}/api/attendance/export?${query}`, {
                headers: {
                    Accept: "text/csv, application/json",
                    ...token ? {
                        Authorization: `Bearer ${token}`
                    } : {}
                }
            });
            if (!res.ok) {
                const body = await res.json().catch(()=>({}));
                throw new ApiError(res.status, body.message ?? `Export failed (${res.status})`, body.errors, body.code);
            }
            const named = /filename="?([^";]+)"?/.exec(res.headers.get("Content-Disposition") ?? "");
            return {
                blob: await res.blob(),
                filename: named?.[1] ?? `attendance-${params.from}-to-${params.to}.csv`
            };
        }
    },
    attendanceCorrections: {
        list: ()=>request("/api/attendance/corrections"),
        all: ()=>requestAll("/api/attendance/corrections?per_page=500"),
        create: (data)=>request("/api/attendance/corrections", {
                method: "POST",
                body: JSON.stringify(data)
            }),
        approve: (id)=>request(`/api/attendance/corrections/${id}/approve`, {
                method: "POST",
                body: "{}"
            }),
        reject: (id)=>request(`/api/attendance/corrections/${id}/reject`, {
                method: "POST",
                body: "{}"
            })
    },
    notifications: {
        list: ()=>request("/api/notifications"),
        markAsRead: (id)=>request(`/api/notifications/${id}/read`, {
                method: "POST"
            }),
        markAllAsRead: ()=>request("/api/notifications/read-all", {
                method: "POST"
            })
    },
    profile: {
        update: (data)=>request("/api/profile", {
                method: "PUT",
                body: JSON.stringify(data)
            }),
        updatePassword: (data)=>request("/api/profile/password", {
                method: "PUT",
                body: JSON.stringify(data)
            })
    }
};
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/lib/http-cache.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * A tiny cache for GET requests to reference data (branches, departments,
 * employees…). Two jobs:
 *  - identical requests already in flight share one network call, so a page
 *    and its dialogs asking for the same list at once cost a single request;
 *  - a recent answer is reused for `ttlMs`, so moving between pages doesn't
 *    re-download the same lists every time.
 * Anything that changes data clears it, so a save is never followed by stale
 * lists. Values are cloned on the way out so a caller can't corrupt the cache
 * by sorting or editing what it received.
 */ __turbopack_context__.s([
    "createHttpCache",
    ()=>createHttpCache
]);
function createHttpCache(ttlMs, now = Date.now) {
    const done = new Map();
    const inflight = new Map();
    // Bumped by clear(): an answer that was already on its way when data changed must not be stored.
    let generation = 0;
    const clone = (value)=>structuredClone(value);
    return {
        async get (key, fetcher) {
            const hit = done.get(key);
            if (hit && now() - hit.at < ttlMs) return clone(hit.value);
            let pending = inflight.get(key);
            if (!pending) {
                const startedIn = generation;
                pending = fetcher().then((value)=>{
                    if (startedIn === generation) done.set(key, {
                        at: now(),
                        value: clone(value)
                    });
                    return value;
                }).finally(()=>{
                    // Only remove our own entry (a clear() may have replaced it).
                    if (inflight.get(key) === pending) inflight.delete(key);
                });
                inflight.set(key, pending);
            }
            return clone(await pending);
        },
        clear () {
            generation++;
            done.clear();
            inflight.clear();
        },
        /** For tests. */ size: ()=>done.size
    };
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/lib/utils.ts [app-client] (ecmascript) <locals>", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([]);
;
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
]);

//# sourceMappingURL=src_0s0ry22._.js.map