import {useEffect, useState} from 'react'
import HttpService from "../../../services/HttpService.ts";

import "../../../styles/Pages/Courses.scss"
import "../../../styles/Shared/backgrounds.scss"
import AddCourseModal from "../../../components/AddCourseModal.tsx";
import ConfirmDialog from "../../../components/ConfirmDialog.tsx";
import ApiImportModal from "../../../components/ApiImportModal.tsx";
import golfBg from "../../../assets/golf-bg.jpg";
import toast from "react-simple-toasts";

interface Course {
    id: number;
    name: string;
    location: string | null;
    num_holes: number;
    tees: CourseTee[];
}

interface CourseTee {
    id: number;
    tee_id: number;
    tee_name: string;
    tee_description: string;
    colour_code: string;
    course_rating: number | null;
    slope_rating: number | null;
    holes: Hole[];
}

interface Hole {
    id: number;
    hole_number: number;
    par: number;
    stroke_index: number;
}

const Courses = () => {
    const [courseModalBool, setCourseModalBool] = useState(false);
    const [courseModalMode, setCourseModalMode] = useState<'add' | 'edit'>('add');
    const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
    const [courses, setCourses] = useState<Course[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [confirmDialog, setConfirmDialog] = useState<{
        isOpen: boolean;
        courseId: number | null;
        courseName: string;
    }>({
        isOpen: false,
        courseId: null,
        courseName: ''
    });
    const [apiImportModalOpen, setApiImportModalOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        fetchCourses();
    }, []);

    const fetchCourses = async () => {
        setIsLoading(true);
        try {
            const httpService = new HttpService();
            const response = await httpService.get("courses");
            setCourses(response.data.data || []);
        } catch (error: any) {
            console.error("Error fetching courses:", error);
            toast("Failed to load courses", {className: "error-toast"});
        } finally {
            setIsLoading(false);
        }
    };

    const handleAddCourseClick = () => {
        setCourseModalMode('add');
        setSelectedCourse(null);
        setCourseModalBool(true);
    }

    const handleEditCourseClick = (course: Course) => {
        setCourseModalMode('edit');
        setSelectedCourse(course);
        setCourseModalBool(true);
    }

    const handleCloseModalClick = () => {
        setCourseModalBool(false);
        setSelectedCourse(null);
    }

    const handleCourseAdded = (newCourse: Course) => {
        setCourses((old) => [...old, newCourse]);
        setCourseModalBool(false);
        toast("Course created successfully!", {className: "success-toast"});
    }

    const handleCourseUpdated = (updatedCourse: Course) => {
        if (!updatedCourse || !updatedCourse.id) {
            // If we didn't get proper data back, refresh the whole list
            fetchCourses();
        } else {
            setCourses((old) => old.map(course => course.id === updatedCourse.id ? updatedCourse : course));
        }
        setCourseModalBool(false);
        setSelectedCourse(null);
        toast("Course updated successfully!", {className: "success-toast"});
    }

    const handleDeleteClick = (course: Course) => {
        setConfirmDialog({
            isOpen: true,
            courseId: course.id,
            courseName: course.name
        });
    };

    const handleConfirmDelete = async () => {
        if (!confirmDialog.courseId) return;

        try {
            const httpService = new HttpService();
            await httpService.delete(`courses/${confirmDialog.courseId}`);
            setCourses((old) => old.filter(c => c.id !== confirmDialog.courseId));
            toast("Course deleted successfully", {className: "success-toast"});
        } catch (error: any) {
            console.error("Error deleting course:", error);
            toast(error.response?.data?.message || "Failed to delete course", {className: "error-toast"});
        } finally {
            setConfirmDialog({isOpen: false, courseId: null, courseName: ''});
        }
    };

    const handleCancelDelete = () => {
        setConfirmDialog({isOpen: false, courseId: null, courseName: ''});
    };

    const handleApiImportClick = () => {
        setApiImportModalOpen(true);
    };

    const handleCloseApiImport = () => {
        setApiImportModalOpen(false);
    };

    const handleCourseImported = () => {
        fetchCourses();
    };

    // Filter courses based on search query
    const filteredCourses = courses.filter(course => 
        course.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (course.location && course.location.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    return (
        <div className="page-with-background">
            <div
                className="page-background"
                style={{backgroundImage: `url(${golfBg})`}}
            />
            <div className="page-content">
                <div className="courses-container">
                    <div className="page-header-glass">
                        <h1>⛳ Courses</h1>
                        <span className="count-badge">{filteredCourses.length}{searchQuery ? ` of ${courses.length}` : ''} course{filteredCourses.length !== 1 ? 's' : ''}</span>
                    </div>

                    <div className="action-bar">
                        <button className="button-primary" onClick={handleAddCourseClick}>
                            <span style={{marginRight: '8px'}}>➕</span> Add Course
                        </button>
                        <div className="search-box">
                            <span className="search-icon">🔍</span>
                            <input
                                type="text"
                                placeholder="Search courses..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="search-input-field"
                            />
                            {searchQuery && (
                                <button 
                                    className="clear-search" 
                                    onClick={() => setSearchQuery('')}
                                    title="Clear search"
                                >
                                    ×
                                </button>
                            )}
                        </div>
                        <button className="button-secondary" onClick={handleApiImportClick}>
                            <span style={{marginRight: '8px'}}>🌐</span> Import from API
                        </button>
                    </div>

                    {isLoading ? (
                        <div className="loading-state">Loading courses...</div>
                    ) : filteredCourses.length === 0 ? (
                        <div className="empty-state-glass">
                            <div className="empty-icon">🔍</div>
                            <h3>{searchQuery ? 'No Matches Found' : 'No Courses Yet'}</h3>
                            <p>{searchQuery ? `No courses matching "${searchQuery}"` : 'Add your first golf course to get started'}</p>
                        </div>
                    ) : (
                        <div className="courses-grid">
                            {filteredCourses.map((course) => (
                                <div key={course.id} className="course-card glass-card">
                                    <div className="card-header">
                                        <div className="course-icon">⛳</div>
                                        <div className="course-info">
                                            <div className="course-name">{course.name}</div>
                                            <div className="course-meta">
                                                {course.location &&
                                                    <span className="location">📍 {course.location}</span>}
                                                <span className="holes">&nbsp;{course.num_holes} holes</span>
                                                {course.tees && (
                                                    <span className="tees">
                                                        &nbsp;{course.tees.map(t => t.tee_name).join(', ')}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="card-actions">
                                        <button
                                            className="action-btn edit"
                                            onClick={() => handleEditCourseClick(course)}
                                            title="Edit course"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18"
                                                 viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                                                 strokeLinecap="round" strokeLinejoin="round">
                                                <path
                                                    d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                                <path
                                                    d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                                            </svg>
                                        </button>
                                        <button
                                            className="action-btn delete"
                                            onClick={() => handleDeleteClick(course)}
                                            title="Delete course"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18"
                                                 viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                                                 strokeLinecap="round" strokeLinejoin="round">
                                                <polyline points="3 6 5 6 21 6"></polyline>
                                                <path
                                                    d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                            </svg>
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {courseModalBool && <AddCourseModal
                mode={courseModalMode}
                course={selectedCourse}
                onCloseModal={handleCloseModalClick}
                onCourseAdded={handleCourseAdded}
                onCourseUpdated={handleCourseUpdated}
            ></AddCourseModal>}

            <ConfirmDialog
                isOpen={confirmDialog.isOpen}
                title="Delete Course"
                message={`Are you sure you want to delete ${confirmDialog.courseName}? This will remove all tee data and cannot be undone.`}
                confirmText="Delete"
                cancelText="Cancel"
                variant="danger"
                onConfirm={handleConfirmDelete}
                onCancel={handleCancelDelete}
            />

            {apiImportModalOpen && (
                <ApiImportModal
                    onClose={handleCloseApiImport}
                    onCourseImported={handleCourseImported}
                />
            )}
        </div>
    )
}
export default Courses
