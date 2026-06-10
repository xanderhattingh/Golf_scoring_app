import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import HttpService from '../../../services/HttpService.ts'
import StorageService from '../../../services/StorageService.ts'
import toast from 'react-simple-toasts'
import golfBg from '../../../assets/golf-bg-2.jpg'
import AuthCrest from '../../../components/AuthCrest.tsx'

import '../../../styles/Pages/profile.scss'
import '../../../styles/Shared/backgrounds.scss'

const profileSchema = z.object({
    name: z.string().min(2, 'Name must be at least 2 characters').max(255),
    surname: z.string().min(2, 'Surname must be at least 2 characters').max(255),
    email: z.string().email('Please enter a valid email address').or(z.literal('')),
    phone: z.string().min(10, 'Phone number must be at least 10 characters'),
    handicap: z.string().refine((val) => {
        const num = Number(val);
        return !isNaN(num) && num >= 0 && num <= 54;
    }, { message: 'Handicap must be between 0 and 54' }),
})

const passwordSchema = z.object({
    current_password: z.string().min(1, 'Current password is required'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
    password_confirmation: z.string().min(1, 'Please confirm your password'),
}).refine((data) => data.password === data.password_confirmation, {
    message: 'Passwords do not match',
    path: ['password_confirmation'],
})

type ProfileFormData = z.infer<typeof profileSchema>
type PasswordFormData = z.infer<typeof passwordSchema>

const Profile = () => {
    const [isLoading, setIsLoading] = useState(true)
    const [isSavingProfile, setIsSavingProfile] = useState(false)
    const [isSavingPassword, setIsSavingPassword] = useState(false)
    const [showCurrentPassword, setShowCurrentPassword] = useState(false)
    const [showNewPassword, setShowNewPassword] = useState(false)
    const [showConfirmPassword, setShowConfirmPassword] = useState(false)
    const [isPasswordOpen, setIsPasswordOpen] = useState(false)
    const [user, setUser] = useState<any>(null)

    const storage = new StorageService()
    const navigate = useNavigate()

    const getInitials = (u: any): string => {
        const first = u?.name?.charAt(0) || ''
        const last = u?.surname?.charAt(0) || ''
        return (first + last).toUpperCase() || '?'
    }

    const {
        register: registerProfile,
        handleSubmit: handleSubmitProfile,
        formState: { errors: profileErrors },
        reset: resetProfile,
    } = useForm<ProfileFormData>({
        resolver: zodResolver(profileSchema),
    })

    const {
        register: registerPassword,
        handleSubmit: handleSubmitPassword,
        formState: { errors: passwordErrors },
        reset: resetPassword,
    } = useForm<PasswordFormData>({
        resolver: zodResolver(passwordSchema),
    })

    useEffect(() => {
        fetchUser()
    }, [])

    const fetchUser = async () => {
        setIsLoading(true)
        try {
            const httpService = new HttpService()
            const response = await httpService.get('user')
            const user = response.data.data
            if (user) {
                setUser(user)
                resetProfile({
                    name: user.name || '',
                    surname: user.surname || '',
                    email: user.email || '',
                    phone: user.phone || '',
                    handicap: String(user.handicap ?? 0),
                })
                storage.updateUser({
                    name: user.name,
                    surname: user.surname,
                    email: user.email,
                    phone: user.phone,
                    handicap: user.handicap,
                })
            }
        } catch (error: any) {
            console.error('Error fetching user:', error)
            toast('Failed to load profile', { className: 'error-toast' })
            const localUser = storage.getUser()
            if (localUser) {
                setUser(localUser)
                resetProfile({
                    name: localUser.name || '',
                    surname: localUser.surname || '',
                    email: localUser.email || '',
                    phone: localUser.phone || '',
                    handicap: String(localUser.handicap ?? 0),
                })
            }
        } finally {
            setIsLoading(false)
        }
    }

    const onSubmitProfile = async (data: ProfileFormData) => {
        setIsSavingProfile(true)
        try {
            const httpService = new HttpService()
            const response = await httpService.put('user', {
                ...data,
                email: data.email || null,
                handicap: Number(data.handicap),
            })
            if (response.data?.success) {
                const updatedUser = response.data.data
                setUser((prev: any) => ({ ...prev, ...updatedUser }))
                storage.updateUser({
                    name: updatedUser.name,
                    surname: updatedUser.surname,
                    email: updatedUser.email,
                    phone: updatedUser.phone,
                    handicap: updatedUser.handicap,
                })
                toast('Profile updated successfully', { className: 'success-toast' })
            } else {
                toast(response.data?.message || 'Failed to update profile', { className: 'error-toast' })
            }
        } catch (error: any) {
            console.error('Error updating profile:', error)
            const message = error.response?.data?.message || error.response?.data?.errors?.phone?.[0] || 'Failed to update profile'
            toast(message, { className: 'error-toast' })
        } finally {
            setIsSavingProfile(false)
        }
    }

    const onSubmitPassword = async (data: PasswordFormData) => {
        setIsSavingPassword(true)
        try {
            const httpService = new HttpService()
            const response = await httpService.put('user/password', {
                current_password: data.current_password,
                password: data.password,
                password_confirmation: data.password_confirmation,
            })
            if (response.data?.success) {
                toast('Password updated successfully', { className: 'success-toast' })
                resetPassword()
            } else {
                toast(response.data?.message || 'Failed to update password', { className: 'error-toast' })
            }
        } catch (error: any) {
            console.error('Error updating password:', error)
            const message = error.response?.data?.message || error.response?.data?.errors?.password?.[0] || 'Failed to update password'
            toast(message, { className: 'error-toast' })
        } finally {
            setIsSavingPassword(false)
        }
    }

    const handleLogout = () => {
        storage.clear()
        toast('Logged out successfully', { className: 'success-toast' })
        navigate('/login')
    }

    if (isLoading) {
        return (
            <div className="page-with-background">
                <div className="page-background" style={{ backgroundImage: `url(${golfBg})` }} />
                <div className="page-content">
                    <div className="profile-container">
                        <div className="loading-state">Loading profile...</div>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="page-with-background">
            <div className="page-background" style={{ backgroundImage: `url(${golfBg})` }} />
            <div className="page-content">
                <div className="profile-container">
                    <header className="clubhouse-header">
                        <div className="clubhouse-header__crest">
                            <AuthCrest />
                        </div>
                        <div className="clubhouse-header__titles">
                            <h1>Profile</h1>
                            <span className="clubhouse-header__sub">Your membership</span>
                        </div>
                    </header>

                    <div className="membership-card">
                        <div className="membership-card__watermark">
                            <AuthCrest />
                        </div>
                        <div className="membership-card__eyebrow">Golf Scoring · Member</div>
                        <div className="membership-card__body">
                            <div className="membership-card__avatar">{getInitials(user)}</div>
                            <div className="membership-card__id">
                                <h2>{user?.name} {user?.surname}</h2>
                                {(user?.email || user?.phone) && (
                                    <div className="membership-card__contact">{user?.email || user?.phone}</div>
                                )}
                            </div>
                        </div>
                        <div className="membership-card__stats">
                            <div className="membership-card__stat">
                                <span className="membership-card__stat-num">{user?.handicap ?? 0}</span>
                                <span className="membership-card__stat-lbl">Handicap</span>
                            </div>
                        </div>
                    </div>

                    <div className="profile-forms">
                        <div className="profile-section">
                            <h2>Profile Details</h2>
                            <form onSubmit={handleSubmitProfile(onSubmitProfile)} className="profile-form" autoComplete="off">
                                <div className="input-group">
                                    <label>First Name</label>
                                    <input
                                        type="text"
                                        autoComplete="off"
                                        {...registerProfile('name')}
                                        placeholder="Enter your first name"
                                    />
                                    {profileErrors.name && (
                                        <span className="error-message">{profileErrors.name.message}</span>
                                    )}
                                </div>

                                <div className="input-group">
                                    <label>Surname</label>
                                    <input
                                        type="text"
                                        autoComplete="off"
                                        {...registerProfile('surname')}
                                        placeholder="Enter your surname"
                                    />
                                    {profileErrors.surname && (
                                        <span className="error-message">{profileErrors.surname.message}</span>
                                    )}
                                </div>

                                <div className="input-group">
                                    <label>Email Address</label>
                                    <input
                                        type="email"
                                        autoComplete="off"
                                        {...registerProfile('email')}
                                        placeholder="Enter your email address"
                                    />
                                    {profileErrors.email && (
                                        <span className="error-message">{profileErrors.email.message}</span>
                                    )}
                                </div>

                                <div className="input-group">
                                    <label>Phone Number</label>
                                    <input
                                        type="text"
                                        autoComplete="off"
                                        {...registerProfile('phone')}
                                        placeholder="Enter your phone number"
                                    />
                                    {profileErrors.phone && (
                                        <span className="error-message">{profileErrors.phone.message}</span>
                                    )}
                                </div>

                                <div className="input-group">
                                    <label>Handicap</label>
                                    <input
                                        type="number"
                                        min={0}
                                        max={54}
                                        autoComplete="off"
                                        {...registerProfile('handicap')}
                                        placeholder="Enter your handicap"
                                    />
                                    {profileErrors.handicap && (
                                        <span className="error-message">{profileErrors.handicap.message}</span>
                                    )}
                                </div>

                                <button
                                    type="submit"
                                    className="button-primary"
                                    disabled={isSavingProfile}
                                >
                                    {isSavingProfile ? 'Saving...' : 'Save Profile'}
                                </button>
                            </form>
                        </div>

                        <div className="profile-section">
                            <button
                                type="button"
                                className="collapsible-header"
                                onClick={() => setIsPasswordOpen(!isPasswordOpen)}
                            >
                                <h2>Change Password</h2>
                                <span className={`chevron ${isPasswordOpen ? 'open' : ''}`}>
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                                         strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                        <polyline points="6 9 12 15 18 9"></polyline>
                                    </svg>
                                </span>
                            </button>
                            {isPasswordOpen && (
                            <form onSubmit={handleSubmitPassword(onSubmitPassword)} className="profile-form" autoComplete="off">
                                <div className="input-group">
                                    <label>Current Password</label>
                                    <div className="password-input-wrapper">
                                        <input
                                            type={showCurrentPassword ? 'text' : 'password'}
                                            autoComplete="off"
                                            {...registerPassword('current_password')}
                                            placeholder="Enter current password"
                                        />
                                        <button
                                            type="button"
                                            className="toggle-password"
                                            onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                                        >
                                            {showCurrentPassword ? '🙈' : '👁️'}
                                        </button>
                                    </div>
                                    {passwordErrors.current_password && (
                                        <span className="error-message">{passwordErrors.current_password.message}</span>
                                    )}
                                </div>

                                <div className="input-group">
                                    <label>New Password</label>
                                    <div className="password-input-wrapper">
                                        <input
                                            type={showNewPassword ? 'text' : 'password'}
                                            autoComplete="new-password"
                                            {...registerPassword('password')}
                                            placeholder="Enter new password"
                                        />
                                        <button
                                            type="button"
                                            className="toggle-password"
                                            onClick={() => setShowNewPassword(!showNewPassword)}
                                        >
                                            {showNewPassword ? '🙈' : '👁️'}
                                        </button>
                                    </div>
                                    {passwordErrors.password && (
                                        <span className="error-message">{passwordErrors.password.message}</span>
                                    )}
                                </div>

                                <div className="input-group">
                                    <label>Confirm New Password</label>
                                    <div className="password-input-wrapper">
                                        <input
                                            type={showConfirmPassword ? 'text' : 'password'}
                                            autoComplete="new-password"
                                            {...registerPassword('password_confirmation')}
                                            placeholder="Confirm new password"
                                        />
                                        <button
                                            type="button"
                                            className="toggle-password"
                                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                        >
                                            {showConfirmPassword ? '🙈' : '👁️'}
                                        </button>
                                    </div>
                                    {passwordErrors.password_confirmation && (
                                        <span className="error-message">{passwordErrors.password_confirmation.message}</span>
                                    )}
                                </div>

                                <button
                                    type="submit"
                                    className="button-primary"
                                    disabled={isSavingPassword}
                                >
                                    {isSavingPassword ? 'Updating...' : 'Update Password'}
                                </button>
                            </form>
                            )}
                        </div>

                        <div className="logout-section">
                            <button
                                type="button"
                                className="logout-button"
                                onClick={handleLogout}
                            >
                                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                                     strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                                    <polyline points="16 17 21 12 16 7"></polyline>
                                    <line x1="21" y1="12" x2="9" y2="12"></line>
                                </svg>
                                Log Out
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default Profile
