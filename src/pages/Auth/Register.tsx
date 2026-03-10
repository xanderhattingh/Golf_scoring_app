import {Navigate} from "react-router-dom";

// In local-only mode, registration is not needed
// Redirect to login page
const Register = () => {
    return <Navigate to="/login" replace />;
}
export default Register
