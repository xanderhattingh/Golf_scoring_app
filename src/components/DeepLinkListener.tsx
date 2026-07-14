import {useEffect} from "react";
import {useNavigate} from "react-router-dom";
import {App as CapApp} from "@capacitor/app";

// Handles custom-scheme deep links coming into the Capacitor app
// (e.g. from the password-reset email). Web builds silently no-op.
const DeepLinkListener = () => {
    const navigate = useNavigate();

    useEffect(() => {
        const handleUrl = (event: {url: string}) => {
            try {
                const url = new URL(event.url);
                // golfscoring://reset?token=…&email=… — the scheme host is "reset"
                const target = (url.hostname || url.pathname.replace(/^\/+/, '')).toLowerCase();
                if (target === 'reset') {
                    const qs = url.searchParams.toString();
                    navigate(`/reset-password${qs ? `?${qs}` : ''}`);
                }
            } catch (e) {
                console.error('DeepLinkListener: failed to parse URL', event.url, e);
            }
        };

        const handle = CapApp.addListener('appUrlOpen', handleUrl);
        return () => { handle.then(h => h.remove()); };
    }, [navigate]);

    return null;
};

export default DeepLinkListener;
