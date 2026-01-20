import {Navigate, Outlet} from "react-router-dom";
import StorageService from "../services/StorageService.ts";

const Protected = () => {
    const storage = new StorageService();
    const ls = JSON.parse(storage.get());
    const auth = {token: ls?.authorisation?.token};
    return (
        auth.token ? <Outlet/> : <Navigate to='/login'/>
    )
}
export default Protected
