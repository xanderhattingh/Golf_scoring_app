// Engraved-style golf crest used on the auth pages.
// A flag planted on the green with a ball and its trajectory, ringed by a
// championship-gold roundel. Pure SVG so it scales crisply on any device.

const AuthCrest = () => {
    return (
        <svg
            className="auth-crest__mark"
            viewBox="0 0 100 100"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
        >
            {/* Roundel */}
            <circle cx="50" cy="50" r="47" stroke="var(--crest-gold)" strokeWidth="1.4" />
            <circle cx="50" cy="50" r="42.5" stroke="var(--crest-gold)" strokeWidth="0.7" opacity="0.45" />

            {/* The green / mound */}
            <ellipse cx="50" cy="71" rx="27" ry="6.5" fill="var(--crest-green)" opacity="0.85" />
            <ellipse cx="50" cy="71" rx="27" ry="6.5" stroke="var(--crest-gold)" strokeWidth="0.6" opacity="0.5" />

            {/* Hole */}
            <ellipse cx="44" cy="70.5" rx="3.4" ry="1.5" fill="#0b1f12" />

            {/* Flag pole */}
            <line x1="44" y1="70.5" x2="44" y2="24" stroke="var(--crest-cream)" strokeWidth="1.6" strokeLinecap="round" />

            {/* Pennant */}
            <path d="M44 25 L64 30.5 L44 36 Z" fill="var(--crest-gold)" />

            {/* Ball */}
            <circle cx="63" cy="69.5" r="3.1" fill="var(--crest-cream)" />
            <circle cx="63" cy="69.5" r="3.1" stroke="var(--crest-gold)" strokeWidth="0.5" opacity="0.6" />

            {/* Trajectory */}
            <path
                d="M62 68 Q56 40 45 27"
                stroke="var(--crest-gold)"
                strokeWidth="1"
                strokeLinecap="round"
                strokeDasharray="0.5 5"
                opacity="0.7"
            />
        </svg>
    );
};

export default AuthCrest;
