import "../../styles/Pages/login.scss"
import "../../styles/Shared/shared.scss"

import golfBg from "../../assets/golf-bg.jpg"
import HttpService from "../../services/HttpService.ts";
import StorageService from "../../services/StorageService.ts";

import {useNavigate, Link} from 'react-router-dom';
import {useState, useEffect} from "react";
import {useForm} from "react-hook-form";
import {zodResolver} from "@hookform/resolvers/zod";
import {z} from "zod";
import toast from "react-simple-toasts";

// Zod validation schema
const loginSchema = z.object({
    phone: z.string()
        .min(1, "Phone number is required")
        .min(10, "Phone number must be at least 10 characters"),
    password: z.string()
        .min(1, "Password is required")
        .min(6, "Password must be at least 6 characters"),
});

type LoginFormData = z.infer<typeof loginSchema>;

const Login = () => {
    const navigate = useNavigate();
    const [isLoading, setIsLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    // Check for existing session on mount
    useEffect(() => {
        const storage = new StorageService();
        if (storage.isLoggedIn()) {
            navigate('/dashboard/courses', { replace: true });
        }
    }, [navigate]);

    const {
        register,
        handleSubmit,
        formState: {errors},
    } = useForm<LoginFormData>({
        resolver: zodResolver(loginSchema),
    });

    const onSubmit = async (data: LoginFormData) => {
        setIsLoading(true);
        try {
            const httpService = new HttpService();
            const response = await httpService.post("login", {
                phone: data.phone,
                password: data.password,
            });

            if (response.data?.success) {
                const storage = new StorageService();
                storage.set(response.data.data);
                toast("Login successful!", {className: "success-toast"});
                navigate('/dashboard/courses');
            } else {
                toast(response.data?.message || "Login failed", {className: "error-toast"});
            }
        } catch (error: any) {
            console.error("Login error:", error);
            const message = error.response?.data?.message || error.response?.data?.errors?.phone?.[0] || "Login failed. Please try again.";
            toast(message, {className: "error-toast"});
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="login-page">
            <div
                className="login-background"
                style={{backgroundImage: `url(${golfBg})`}}
            />
            <div className="login-container">
                <div className="login-content">
                    <div className="login-header">
                        Golf Scoring
                    </div>
                    <div className="login-subtitle">
                        Track. Compete. Improve.
                    </div>

                    <div className="login-image">
                        <div className="ball-ring"></div>
                    </div>

                    <form className="login-form" onSubmit={handleSubmit(onSubmit)} autoComplete="off">
                        <div className="input-group">
                            <label htmlFor="phone">Phone Number</label>
                            <input
                                id="phone"
                                type="tel"
                                placeholder="Enter your phone number"
                                autoComplete="off"
                                {...register("phone")}
                            />
                            {errors.phone && (
                                <span className="error-message">{errors.phone.message}</span>
                            )}
                        </div>

                        <div className="input-group">
                            <label htmlFor="password">Password</label>
                            <div className="password-input-wrapper">
                                <input
                                    id="password"
                                    type={showPassword ? "text" : "password"}
                                    placeholder="Enter your password"
                                    autoComplete="new-password"
                                    {...register("password")}
                                />
                                <button
                                    type="button"
                                    className="toggle-password"
                                    onClick={() => setShowPassword(!showPassword)}
                                    tabIndex={-1}
                                >
                                    {showPassword ? "🙈" : "👁️"}
                                </button>
                            </div>
                            {errors.password && (
                                <span className="error-message">{errors.password.message}</span>
                            )}
                        </div>

                        <button
                            type="submit"
                            className="login-button"
                            disabled={isLoading}
                        >
                            {isLoading ? "Signing In..." : "Sign In"}
                        </button>
                    </form>

                    <div className="no-account">
                        Don't have an account?{" "}
                        <Link to="/register">Register</Link>
                    </div>
                </div>

                <div className="login-footer">
                    <div className="golf-quote">"The most important shot in golf is the next one."</div>
                    <div>— Ben Hogan</div>
                </div>
            </div>
        </div>
    )
}

export default Login
