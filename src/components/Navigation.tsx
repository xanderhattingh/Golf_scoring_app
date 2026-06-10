import {NavLink} from "react-router-dom";
import AuthCrest from "./AuthCrest.tsx";

// Crisp line icons (stroke uses currentColor so active/inactive theming is free)
const icons = {
    courses: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
             strokeLinecap="round" strokeLinejoin="round">
            <line x1="5" y1="21" x2="5" y2="3"/>
            <path d="M5 4 L18 7 L5 10 Z"/>
        </svg>
    ),
    friends: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
             strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
            <circle cx="9" cy="7" r="4"/>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
            <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
        </svg>
    ),
    rounds: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
             strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/>
            <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/>
            <path d="M4 22h16"/>
            <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/>
            <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/>
            <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>
        </svg>
    ),
    profile: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
             strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
            <circle cx="12" cy="7" r="4"/>
        </svg>
    ),
};

const navItems = [
    {to: "/dashboard/courses", label: "Courses", icon: icons.courses},
    {to: "/dashboard/friends", label: "Friends", icon: icons.friends},
    {to: "/dashboard/rounds", label: "Rounds", icon: icons.rounds},
    {to: "/dashboard/profile", label: "Profile", icon: icons.profile},
];

const Navigation = () => {
    return (
        <nav className="navigation-container">
            <div className="left">
                <span className="nav-brand-crest"><AuthCrest/></span>
                <span className="nav-brand-name">Golf <span>Scoring</span></span>
            </div>
            <div className="right">
                {navItems.map((item) => (
                    <NavLink key={item.to} to={item.to}>
                        <span className="nav-icon">{item.icon}</span>
                        <span className="nav-label">{item.label}</span>
                    </NavLink>
                ))}
            </div>
        </nav>
    );
};

export default Navigation;
