import {useState} from 'react'

import "../../styles/Pages/login.scss"
import "../../styles/Shared/shared.scss"

import login_image from "../../assets/login-image.png"
import InputGroup from "../../components /InputGroup.tsx";
import {z} from "zod";

import {useForm} from "react-hook-form";
import {zodResolver} from "@hookform/resolvers/zod";
import HttpService from "../../services/HttpService.ts";
import {Link} from "react-router-dom";

import toast from 'react-simple-toasts';
import 'react-simple-toasts/dist/style.css';
import 'react-simple-toasts/dist/theme/failure.css';
import StorageService from "../../services/StorageService.ts";

import {useNavigate} from 'react-router-dom';
import {HashLoader} from "react-spinners";


const login_schema = z.object({
    email: z.email(),
    password: z.string().min(8).max(16).regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*])(?=.{8,16}$)/),
})

const Login = () => {

    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const {
        register: login_form,
        handleSubmit,
        formState: {isValid},
    } = useForm(
        {
            resolver: zodResolver(login_schema),
            mode: "onChange"
        });


    const onLogin = async (values) => {
        setLoading(true);
        const apiService = new HttpService();
        const {request, cancel} = await apiService.post('/login', values);

        request.then(
            (response) => {
                setLoading(false);
                const storage = new StorageService();
                storage.set(response?.data);
                navigate('/dashboard/courses');
            },
            () => {
                setLoading(false);
                toast('Could not log you in', {theme: 'failure', duration: 3000});
            }
        ).catch(() => {
            setLoading(false);
            toast('Could not log you in', {theme: 'failure', duration: 3000});
        })


        return () => {
            // Cleanup logic: if the component unmounts before the request completes, cancel the request
            cancel("Component unmounted, aborting request");
        };
    }

    if (loading) {
        return (
            <div className="login-container">
                <HashLoader color={"#155DFC"}/>
            </div>
        )
    } else {
        return (
            <>
                <div className="login-container">
                    <div className="login-header">
                        Login
                    </div>
                    <div className="login-image">
                        <img src={login_image}/>
                    </div>
                    <div className="login-form">
                        <form className="login-form" onSubmit={handleSubmit(onLogin)}>
                            <InputGroup
                                label_value="Email Address"
                                type="email"
                                placeholder="Email address"
                                {...login_form("email")}
                            ></InputGroup>

                            <InputGroup
                                label_value="Password"
                                type="password"
                                placeholder="Password"
                                {...login_form("password")}
                            ></InputGroup>
                            <button className="button-primary" disabled={!isValid}>Submit</button>
                        </form>
                    </div>
                    <span className="no-account">
					Do not have an account? <Link to="/register">Register</Link>
				</span>
                </div>
            </>
        )
    }

}
export default Login
