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
import {HashLoader} from "react-spinners";

import toast from 'react-simple-toasts';
import 'react-simple-toasts/dist/style.css';
import 'react-simple-toasts/dist/theme/failure.css';

import {useNavigate} from 'react-router-dom';
import StorageService from "../../services/StorageService.ts";


const register_schema = z.object({
    email: z.email(),
    password: z.string().min(8).max(16).regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*])(?=.{8,16}$)/),
    phone: z.string().min(8).max(12)
})

const Register = () => {

    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const {
        register: register_form,
        handleSubmit,
        formState: {isValid}
    } = useForm(
        {
            resolver: zodResolver(register_schema),
            mode: "onChange"
        });


    const onLogin = async (values) => {
        setLoading(true);
        const apiService = new HttpService();
        const {request, cancel} = await apiService.post('/register', values);

        request.then((response) => {
            setLoading(false);
            const storage = new StorageService();
            storage.set(response?.data);
            navigate('/dashboard/courses');
        }, () => {
            setLoading(false);
            console.log("error here 1");
            toast('Could not register', {theme: 'failure', duration: 3000});
        }).catch(() => {
            setLoading(false);
            console.log("error here 2");
            toast('Could not register', {theme: 'failure', duration: 3000});
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
                        Register
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
                                {...register_form("email")}
                            ></InputGroup>

                            <InputGroup
                                label_value="Password"
                                type="password"
                                placeholder="Password"
                                {...register_form("password")}
                            ></InputGroup>

                            <InputGroup
                                label_value="Phone"
                                type="text"
                                placeholder="Phone number"
                                {...register_form("phone")}
                            ></InputGroup>
                            <button className="button-primary" disabled={!isValid}>Submit</button>
                        </form>
                    </div>
                    <span className="no-account">
					Already have an account? <Link to="/login">Log in</Link>
				</span>
                </div>
            </>
        )
    }


}
export default Register
