import "../../styles/Pages/login.scss";
import "../../styles/Shared/shared.scss";

import golfBg from "../../assets/golf-bg.jpg";
import AuthCrest from "../../components/AuthCrest.tsx";
import HttpService from "../../services/HttpService.ts";

import {Link} from "react-router-dom";
import {useState} from "react";
import {useForm} from "react-hook-form";
import {zodResolver} from "@hookform/resolvers/zod";
import {z} from "zod";
import toast from "react-simple-toasts";

const schema = z.object({
    email: z.string().min(1, "Email is required").email("Enter a valid email address"),
});

type FormData = z.infer<typeof schema>;

const ForgotPassword = () => {
    const [isLoading, setIsLoading] = useState(false);
    const [sent, setSent] = useState(false);

    const {register, handleSubmit, formState: {errors}} = useForm<FormData>({
        resolver: zodResolver(schema),
    });

    const onSubmit = async (data: FormData) => {
        setIsLoading(true);
        try {
            const httpService = new HttpService();
            const response = await httpService.post("password/forgot", {email: data.email});
            if (response.data?.success) {
                setSent(true);
            } else {
                toast(response.data?.message || "Something went wrong", {className: "error-toast"});
            }
        } catch (error: any) {
            const message = error.response?.data?.message
                || error.response?.data?.errors?.email?.[0]
                || "Something went wrong. Please try again.";
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
                        <div className="login-header">Reset <span>Password</span></div>
                        <div className="login-subtitle">
                            {sent ? "Check your inbox" : "Enter your email"}
                        </div>

                        {sent ? (
                            <div style={{textAlign: 'center', padding: '18px 4px 6px'}}>
                                <p style={{color: 'var(--crest-cream, #f4efe2)', lineHeight: 1.6, margin: '0 0 14px 0'}}>
                                    If an account with that email exists, we've sent a link to reset your password.
                                </p>
                                <p style={{color: '#a89f8a', fontSize: 13, lineHeight: 1.6, margin: 0}}>
                                    The link expires in 60 minutes. Tap it on your device to open the app and choose a new password.
                                </p>
                            </div>
                        ) : (
                            <form className="login-form" onSubmit={handleSubmit(onSubmit)} autoComplete="off">
                                <div className="input-group">
                                    <input
                                        id="email"
                                        type="email"
                                        placeholder=" "
                                        autoComplete="email"
                                        {...register("email")}
                                    />
                                    <label htmlFor="email">Email</label>
                                    {errors.email && <span className="error-message">{errors.email.message}</span>}
                                </div>

                                <button type="submit" className="login-button" disabled={isLoading}>
                                    {isLoading ? "Sending..." : "Send Reset Link"}
                                </button>
                            </form>
                        )}

                        <div className="no-account">
                            <Link to="/login">Back to sign in</Link>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ForgotPassword;
