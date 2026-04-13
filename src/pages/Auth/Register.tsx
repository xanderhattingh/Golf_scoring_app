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
const registerSchema = z.object({
    name: z.string().min(2).max(255).optional().or(z.literal("")),
    surname: z.string().min(2).max(255).optional().or(z.literal("")),
    phone: z.string().min(10).optional().or(z.literal("")),
    password: z.string().min(6, "Password must be at least 6 characters"),
    confirmPassword: z.string(),
    inviteCode: z.string().length(6).regex(/^\d{6}$/).optional().or(z.literal("")),
}).superRefine((data, ctx) => {
    // If no invite code, require name and surname
    if (!data.inviteCode) {
        if (!data.name || data.name.length < 2) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "First name is required",
                path: ["name"],
            });
        }
        if (!data.surname || data.surname.length < 2) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "Surname is required",
                path: ["surname"],
            });
        }
    }

    // Phone is ALWAYS required for registration
    if (!data.phone || data.phone.length < 10) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Phone number is required",
            path: ["phone"],
        });
    }

    // If invite code is provided, validate it's 6 digits
    if (data.inviteCode && !/^\d{6}$/.test(data.inviteCode)) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Invite code must be 6 digits",
            path: ["inviteCode"],
        });
    }

    // Always check password match
    if (data.password !== data.confirmPassword) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Passwords do not match",
            path: ["confirmPassword"],
        });
    }
});

type RegisterFormData = z.infer<typeof registerSchema>;

const Register = () => {
    const navigate = useNavigate();
    const [isLoading, setIsLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [useInviteCode, setUseInviteCode] = useState(false);

    // Check for existing session on mount
    useEffect(() => {
        const storage = new StorageService();
        if (storage.isLoggedIn()) {
            navigate('/dashboard/courses', {replace: true});
        }
    }, [navigate]);

    const {
        register,
        handleSubmit,
        formState: {errors},
        setValue,
    } = useForm<RegisterFormData>({
        resolver: zodResolver(registerSchema),
    });

    const toggleInviteCode = () => {
        const newValue = !useInviteCode;
        setUseInviteCode(newValue);
        if (!newValue) {
            setValue("inviteCode", "");
        }
    };

    const onSubmit = async (data: RegisterFormData) => {
        setIsLoading(true);

        try {
            const httpService = new HttpService();

            // If invite code is provided, use invite registration endpoint
            if (useInviteCode && data.inviteCode) {
                const response = await httpService.post("register/invite", {
                    invite_code: data.inviteCode,
                    password: data.password,
                    phone: data.phone || undefined,
                });

                if (response.data?.success) {
                    const storage = new StorageService();
                    storage.set(response.data.data);
                    toast("Registration completed successfully!", {className: "success-toast"});
                    navigate('/dashboard/courses');
                } else {
                    toast(response.data?.message || "Registration failed", {className: "error-toast"});
                }
            } else {
                // Regular registration
                const response = await httpService.post("register", {
                    name: data.name,
                    surname: data.surname,
                    phone: data.phone,
                    password: data.password,
                    handicap: 0,
                });

                if (response.data?.success) {
                    const storage = new StorageService();
                    storage.set(response.data.data);
                    toast("Registration successful!", {className: "success-toast"});
                    navigate('/dashboard/courses');
                } else {
                    toast(response.data?.message || "Registration failed", {className: "error-toast"});
                }
            }
        } catch (error: any) {
            console.error("Registration error:", error);

            if (error.response?.data?.errors) {
                const errors = error.response.data.errors;
                const firstError = Object.values(errors)[0] as string[];
                toast(firstError[0], {className: "error-toast"});
            } else if (error.response?.data?.message) {
                toast(error.response.data.message, {className: "error-toast"});
            } else {
                toast(error.message || "Registration failed. Please try again.", {className: "error-toast"});
            }
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
                        {useInviteCode ? "Complete Your Registration" : "Create Your Account"}
                    </div>

                    <div className="login-image">
                        <div className="ball-ring"></div>
                    </div>

                    <form className="login-form" onSubmit={handleSubmit(onSubmit)} autoComplete="off">
                        {/* Show invite code field and optional phone when toggle is on */}

                        {/* Toggle to show if the user has an invite code */}
                        <div className="toggle-wrapper">
                            <span className="toggle-label">I have an invite code</span>
                            <div
                                className={`toggle-switch ${useInviteCode ? 'active' : ''}`}
                                onClick={toggleInviteCode}
                                role="switch"
                                aria-checked={useInviteCode}
                            >
                                <div className="toggle-knob"></div>
                            </div>
                        </div>


                        {useInviteCode && (
                            <>
                                <div className="input-group">
                                    <label htmlFor="inviteCode">Invite Code</label>
                                    <input
                                        id="inviteCode"
                                        type="text"
                                        placeholder="Enter 6-digit invite code"
                                        maxLength={6}
                                        autoComplete="off"
                                        {...register("inviteCode")}
                                    />
                                    {errors.inviteCode && (
                                        <span className="error-message">{errors.inviteCode.message}</span>
                                    )}
                                </div>
                                <div className="input-group">
                                    <label htmlFor="phone">Phone Number *</label>
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
                            </>
                        )}

                        {/* Only show name/phone fields if NOT using invite code */}
                        {!useInviteCode && (
                            <>
                                <div className="input-group">
                                    <label htmlFor="name">First Name</label>
                                    <input
                                        id="name"
                                        type="text"
                                        placeholder="Enter your first name"
                                        autoComplete="off"
                                        {...register("name")}
                                    />
                                    {errors.name && (
                                        <span className="error-message">{errors.name.message}</span>
                                    )}
                                </div>

                                <div className="input-group">
                                    <label htmlFor="surname">Surname</label>
                                    <input
                                        id="surname"
                                        type="text"
                                        placeholder="Enter your surname"
                                        autoComplete="off"
                                        {...register("surname")}
                                    />
                                    {errors.surname && (
                                        <span className="error-message">{errors.surname.message}</span>
                                    )}
                                </div>

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
                            </>
                        )}

                        <div className="input-group">
                            <label htmlFor="password">Password</label>
                            <div className="password-input-wrapper">
                                <input
                                    id="password"
                                    type={showPassword ? "text" : "password"}
                                    placeholder="Create a password"
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

                        <div className="input-group">
                            <label htmlFor="confirmPassword">Confirm Password</label>
                            <div className="password-input-wrapper">
                                <input
                                    id="confirmPassword"
                                    type={showConfirmPassword ? "text" : "password"}
                                    placeholder="Confirm your password"
                                    autoComplete="new-password"
                                    {...register("confirmPassword")}
                                />
                                <button
                                    type="button"
                                    className="toggle-password"
                                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                    tabIndex={-1}
                                >
                                    {showConfirmPassword ? "🙈" : "👁️"}
                                </button>
                            </div>
                            {errors.confirmPassword && (
                                <span className="error-message">{errors.confirmPassword.message}</span>
                            )}
                        </div>

                        <button
                            type="submit"
                            className="login-button"
                            disabled={isLoading}
                        >
                            {isLoading
                                ? (useInviteCode ? "Completing Registration..." : "Creating Account...")
                                : (useInviteCode ? "Complete Registration" : "Create Account")
                            }
                        </button>
                    </form>

                    <div className="no-account">
                        Already have an account?{" "}
                        <Link to="/login">Sign In</Link>
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

export default Register
