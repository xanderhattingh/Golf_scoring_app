import {useEffect, useState} from 'react'
import HttpService from "../../services/HttpService.ts";

import toast from 'react-simple-toasts';
import 'react-simple-toasts/dist/style.css';
import 'react-simple-toasts/dist/theme/failure.css';
import {HashLoader} from "react-spinners";
import "../../styles/Pages/Courses.scss"
import AddCourseModal from "../../components /AddCourseModal.tsx";

const Courses = () => {
    const [addCourseModalBool, setAddCourseModalBool] = useState(false);
    const [courses, setCourses] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const getCourses = async () => {
            setCourses([]);
            const apiService = new HttpService();
            const {request} = await apiService.post('/get_courses', {});

            request.then((response) => {
                console.log(response);
                setLoading(false);
                setCourses(response.data);
            }, () => {
                setLoading(false);
                toast('Could not get the courses', {theme: 'failure', duration: 3000});
            }).catch(() => {
                setLoading(false);
                toast('Could not get the courses', {theme: 'failure', duration: 3000});
            })


        }

        getCourses()

    }, []);

    const handleAddCourseClick = () => {
        setAddCourseModalBool(true);
    }

    const handleCloseModalClick = () => {
        setAddCourseModalBool(false);
    }

    const handleCourseAdded = ($event) => {
        console.log($event);
        setCourses((old) => [...old, $event]);
        setAddCourseModalBool(false)
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
                {courses.map((course, index) => (
                    <div key={index} className="course" style={{color: 'white'}}>
                        {course.name}
                    </div>
                ))}
                <div className="courses-container">
                    <div className="action-buttons">
                        <button className="button-primary" onClick={handleAddCourseClick}>Add course</button>
                    </div>

                </div>
                {addCourseModalBool && <AddCourseModal onCloseModal={handleCloseModalClick}
                                                       onCourseAdded={handleCourseAdded}></AddCourseModal>}

            </>
        )
    }

}
export default Courses
