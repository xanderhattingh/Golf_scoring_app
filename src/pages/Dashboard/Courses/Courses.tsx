import {useEffect, useState} from 'react'
import HttpService from "../../../services/HttpService.ts";

import toast from 'react-simple-toasts';
import 'react-simple-toasts/dist/style.css';
import 'react-simple-toasts/dist/theme/failure.css';
import {HashLoader} from "react-spinners";
import "../../../styles/Pages/Courses.scss"
import AddCourseModal from "../../../components /AddCourseModal.tsx";

const Courses = () => {
    const [courseModalBool, setCourseModalBool] = useState(false);
    const [courseModalMode, setCourseModalMode] = useState<'add' | 'edit'>('add');
    const [selectedCourse, setSelectedCourse] = useState(null);
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
        setCourseModalMode('add');
        setSelectedCourse(null);
        setCourseModalBool(true);
    }

    const handleEditCourseClick = (course) => {
        setCourseModalMode('edit');
        setSelectedCourse(course);
        setCourseModalBool(true);
    }

    const handleCloseModalClick = () => {
        setCourseModalBool(false);
        setSelectedCourse(null);
    }

    const handleCourseAdded = ($event) => {
        console.log($event);
        setCourses((old) => [...old, $event]);
        setCourseModalBool(false)
    }

    const handleCourseUpdated = ($event) => {
        console.log($event);
        setCourses((old) => old.map(course => course.id === $event.id ? $event : course));
        setCourseModalBool(false);
        setSelectedCourse(null);
    }

    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
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
                <div className="courses-container">
                    <div className="table-container">
                        <div className="table-header">
                            <div className="table-cell">Name</div>
                            <div className="table-cell">Created At</div>
                            <div className="table-cell">Actions</div>
                        </div>
                        {courses.map((course, index) => (
                            <div key={index} className="table-row">
                                <div className="table-cell">{course.name}</div>
                                <div className="table-cell">{formatDate(course.created_at)}</div>
                                <div className="table-cell">
                                    <button className="button-secondary" onClick={() => handleEditCourseClick(course)}>Edit</button>
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="action-buttons">
                        <button className="button-primary" onClick={handleAddCourseClick}>Add course</button>
                    </div>

                </div>
                {courseModalBool && <AddCourseModal
                    mode={courseModalMode}
                    course={selectedCourse}
                    onCloseModal={handleCloseModalClick}
                    onCourseAdded={handleCourseAdded}
                    onCourseUpdated={handleCourseUpdated}
                ></AddCourseModal>}

            </>
        )
    }

}
export default Courses
