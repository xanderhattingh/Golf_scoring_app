import "../../styles/Pages/login.scss"
import "../../styles/Shared/shared.scss"

import login_image from "../../assets/login-image.png"
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
        <>
            <div className="login-container">
                <div className="login-header">
                    Golf Scoring
                </div>
                <div className="login-image">
                    <img src={login_image} alt="Golf"/>
                </div>
                <div className="login-form">
                    <p style={{textAlign: 'center', marginBottom: '20px', color: '#666'}}>
                        Your personal golf scoring app
                    </p>
                    <button className="button-primary" onClick={onEnter}>
                        Enter App
                    </button>
                </div>
            </div>
        </>
    )

}
export default Login
