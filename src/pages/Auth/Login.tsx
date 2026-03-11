import "../../styles/Pages/login.scss"
import "../../styles/Shared/shared.scss"

import golfBg from "../../assets/golf-bg.jpg"
import LocalDataService from "../../services/LocalDataService.ts";

import {useNavigate} from 'react-router-dom';
import {useEffect} from "react";

const Login = () => {
    const navigate = useNavigate();

    useEffect(() => {
        // Initialize local user on mount
        const dataService = new LocalDataService();
        dataService.initializeLocalUser();
    }, []);

    const onEnter = () => {
        const dataService = new LocalDataService();
        dataService.initializeLocalUser();
        navigate('/dashboard/courses');
    }

    return (
        <div className="login-page">
            <div 
                className="login-background" 
                style={{ backgroundImage: `url(${golfBg})` }}
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
                    
                    <div className="login-form">
                        <p className="tagline">
                            Your personal golf scoring companion
                        </p>
                        <button className="enter-button" onClick={onEnter}>
                            Enter App
                        </button>
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
