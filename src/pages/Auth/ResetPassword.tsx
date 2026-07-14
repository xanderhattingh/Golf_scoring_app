import "../../styles/Pages/login.scss";
import "../../styles/Shared/shared.scss";

import golfBg from "../../assets/golf-bg.jpg";
import AuthCrest from "../../components/AuthCrest.tsx";
import HttpService from "../../services/HttpService.ts";

import {Link, useNavigate, useSearchParams} from "react-router-dom";
import {useState} from "react";
import {useForm} from "react-hook-form";
import {zodResolver} from "@hookform/resolvers/zod";
import {z} from "zod";
import toast from "react-simple-toasts";

const schema = z.object({
    password: z.string().min(6, "Password must be at least 6 characters"),
    password_confirmation: z.string().min(1, "Please confirm your password"),
}).refine((v) => v.password === v.password_confirmation, {
    message: "Passwords do not match",
    path: ["password_confirmation"],
});

type FormData = z.infer<typeof schema>;

const ResetPassword = () => {
    const navigate = useNavigate();
    const [params] = useSearchParams();
    const token = params.get("token") || "";
    const email = params.get("email") || "";

    const [isLoading, setIsLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    const {register, handleSubmit, formState: {errors}} = useForm<FormData>({
        resolver: zodResolver(schema),
    });

    const hasLink = token.length > 0 && email.length > 0;

    const onSubmit = async (data: FormData) => {
        if (!hasLink) return;
        setIsLoading(true);
        try {
            const httpService = new HttpService();
            const response = await httpService.post("password/reset", {
                email,
                token,
                password: data.password,
                password_confirmation: data.password_confirmation,
            });
            if (response.data?.success) {
                toast("Password reset. Please sign in.", {className: "success-toast"});
                navigate("/login");
            } else {
                toast(response.data?.message || "Reset failed", {className: "error-toast"});
            }
        } catch (error: any) {
            const message = error.response?.data?.message
                || error.response?.data?.errors?.password?.[0]
                || "Reset failed. The link may have expired.";
            toast(message, {className: "error-toast"});
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="login-page">
            <div className="login-background" style={{backgroundImage: `url(${golfBg})`}} />
            <div className="login-container">
                <div className="login-content">
                    <div className="auth-card">
                        <div className="auth-crest"><AuthCrest /></div>
                        <div className="login-header">Choose a <span>new password</span></div>
                        <div className="login-subtitle">
                            {hasLink ? email : "Invalid reset link"}
                        </div>

                        {!hasLink ? (
                            <div style={{textAlign: 'center', padding: '18px 4px 6px'}}>
                                <p style={{color: 'var(--crest-cream, #f4efe2)', lineHeight: 1.6, margin: '0 0 14px 0'}}>
                                    This reset link is missing information. Please request a new one.
                                </p>
                            </div>
                        ) : (
                            <form className="login-form" onSubmit={handleSubmit(onSubmit)} autoComplete="off">
                                <div className="input-group">
                                    <div className="password-input-wrapper">
                                        <input
                                            id="password"
                                            type={showPassword ? "text" : "password"}
                                            placeholder=" "
                                            autoComplete="new-password"
                                            {...register("password")}
                                        />
                                        <label htmlFor="password">New Password</label>
                                        <button
                                            type="button"
                                            className="toggle-password"
                                            onClick={() => setShowPassword(!showPassword)}
                                            tabIndex={-1}
                                        >{showPassword ? "🙈" : "👁️"}</button>
                                    </div>
                                    {errors.password && <span className="error-message">{errors.password.message}</span>}
                                </div>

                                <div className="input-group">
                                    <input
                                        id="password_confirmation"
                                        type={showPassword ? "text" : "password"}
                                        placeholder=" "
                                        autoComplete="new-password"
                                        {...register("password_confirmation")}
                                    />
                                    <label htmlFor="password_confirmation">Confirm New Password</label>
                                    {errors.password_confirmation && (
                                        <span className="error-message">{errors.password_confirmation.message}</span>
                                    )}
                                </div>

                                <button type="submit" className="login-button" disabled={isLoading}>
                                    {isLoading ? "Saving..." : "Save New Password"}
                                </button>
                            </form>
                        )}

                        <div className="no-account">
                            <Link to="/forgot-password">Request a new link</Link>
                            {" · "}
                            <Link to="/login">Back to sign in</Link>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ResetPassword;
