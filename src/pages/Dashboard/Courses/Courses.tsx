import {useEffect, useState} from 'react'
import HttpService from "../../../services/HttpService.ts";

import "../../../styles/Pages/Courses.scss"
import "../../../styles/Shared/backgrounds.scss"
import AddCourseModal from "../../../components/AddCourseModal.tsx";
import ConfirmDialog from "../../../components/ConfirmDialog.tsx";
import ApiImportModal from "../../../components/ApiImportModal.tsx";
import AuthCrest from "../../../components/AuthCrest.tsx";
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

    // Pull the holes (ordered) from a course's first tee for the mini scorecard
    const getHoles = (course: Course): Hole[] => {
        const tee = course.tees?.[0];
        if (!tee?.holes?.length) return [];
        return [...tee.holes].sort((a, b) => a.hole_number - b.hole_number);
    };

    const sumPar = (holes: Hole[]): number => holes.reduce((total, h) => total + (h.par || 0), 0);

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
                    <header className="clubhouse-header">
                        <div className="clubhouse-header__crest">
                            <AuthCrest />
                        </div>
                        <div className="clubhouse-header__titles">
                            <h1>Courses</h1>
                            <span className="clubhouse-header__sub">
                                {filteredCourses.length}{searchQuery ? ` of ${courses.length}` : ''} course{filteredCourses.length !== 1 ? 's' : ''} in your clubhouse
                            </span>
                        </div>
                    </header>

                    <div className="courses-toolbar">
                        <button className="btn-course btn-course--add" onClick={handleAddCourseClick}>
                            <span className="btn-course__plus">+</span> Add Course
                        </button>
                        <div className="courses-search">
                            <svg className="courses-search__icon" width="16" height="16" viewBox="0 0 24 24" fill="none"
                                 stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="11" cy="11" r="8"></circle>
                                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                            </svg>
                            <input
                                type="text"
                                placeholder="Search courses..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="courses-search__input"
                            />
                            {searchQuery && (
                                <button
                                    className="courses-search__clear"
                                    onClick={() => setSearchQuery('')}
                                    title="Clear search"
                                >
                                    ×
                                </button>
                            )}
                        </div>
                        <button className="btn-course btn-course--import" onClick={handleApiImportClick}>
                            Import from API
                        </button>
                    </div>

                    {isLoading ? (
                        <div className="courses-grid">
                            {[0, 1, 2].map((i) => (
                                <div key={i} className="scorecard scorecard--skeleton" />
                            ))}
                        </div>
                    ) : filteredCourses.length === 0 ? (
                        <div className="courses-empty">
                            <div className="courses-empty__crest">
                                <AuthCrest />
                            </div>
                            <h3>{searchQuery ? 'No matches found' : 'No courses yet'}</h3>
                            <p>{searchQuery ? `Nothing in the clubhouse matches "${searchQuery}"` : 'Add your first course to start keeping the card.'}</p>
                            {!searchQuery && (
                                <button className="btn-course btn-course--add" onClick={handleAddCourseClick}>
                                    <span className="btn-course__plus">+</span> Add Course
                                </button>
                            )}
                        </div>
                    ) : (
                        <div className="courses-grid">
                            {filteredCourses.map((course) => {
                                const holes = getHoles(course);
                                const front = holes.slice(0, 9);
                                const back = holes.slice(9, 18);
                                const par = sumPar(holes);
                                const out = sumPar(front);
                                const inn = sumPar(back);
                                return (
                                    <article key={course.id} className="scorecard">
                                        <div className="scorecard__head">
                                            <div className="scorecard__badge">
                                                {course.name.charAt(0).toUpperCase()}
                                            </div>
                                            <div className="scorecard__title">
                                                <h2>{course.name}</h2>
                                                {course.location && (
                                                    <div className="scorecard__loc">
                                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                                                             stroke="currentColor" strokeWidth="2" strokeLinecap="round"
                                                             strokeLinejoin="round">
                                                            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                                                            <circle cx="12" cy="10" r="3"></circle>
                                                        </svg>
                                                        {course.location}
                                                    </div>
                                                )}
                                            </div>
                                            <div className="scorecard__actions">
                                                <button
                                                    className="scorecard__btn"
                                                    onClick={() => handleEditCourseClick(course)}
                                                    title="Edit course"
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"
                                                         viewBox="0 0 24 24" fill="none" stroke="currentColor"
                                                         strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                                                    </svg>
                                                </button>
                                                <button
                                                    className="scorecard__btn scorecard__btn--danger"
                                                    onClick={() => handleDeleteClick(course)}
                                                    title="Delete course"
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"
                                                         viewBox="0 0 24 24" fill="none" stroke="currentColor"
                                                         strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                        <polyline points="3 6 5 6 21 6"></polyline>
                                                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                                    </svg>
                                                </button>
                                            </div>
                                        </div>

                                        <div className="scorecard__stats">
                                            {par > 0 && (
                                                <div className="scorecard__stat">
                                                    <span className="scorecard__stat-num">{par}</span>
                                                    <span className="scorecard__stat-lbl">Par</span>
                                                </div>
                                            )}
                                            <div className="scorecard__stat">
                                                <span className="scorecard__stat-num">{course.num_holes}</span>
                                                <span className="scorecard__stat-lbl">Holes</span>
                                            </div>
                                            {course.tees?.length > 0 && (
                                                <div className="scorecard__tees" title={course.tees.map(t => t.tee_name).join(', ')}>
                                                    {course.tees.map((t) => (
                                                        <span
                                                            key={t.id}
                                                            className="scorecard__tee-dot"
                                                            style={{backgroundColor: t.colour_code || '#ccc'}}
                                                        />
                                                    ))}
                                                    <span className="scorecard__tees-count">
                                                        {course.tees.length} tee{course.tees.length !== 1 ? 's' : ''}
                                                    </span>
                                                </div>
                                            )}
                                        </div>

                                        {holes.length > 0 && (
                                            <div className="scorecard__strip">
                                                <div className="scorecard__nine">
                                                    {front.map((h) => (
                                                        <span key={h.hole_number} className="scorecard__cell">
                                                            <i>{h.hole_number}</i>
                                                            <b>{h.par}</b>
                                                        </span>
                                                    ))}
                                                    <span className="scorecard__cell scorecard__cell--total">
                                                        <i>out</i>
                                                        <b>{out}</b>
                                                    </span>
                                                </div>
                                                {back.length > 0 && (
                                                    <div className="scorecard__nine">
                                                        {back.map((h) => (
                                                            <span key={h.hole_number} className="scorecard__cell">
                                                                <i>{h.hole_number}</i>
                                                                <b>{h.par}</b>
                                                            </span>
                                                        ))}
                                                        <span className="scorecard__cell scorecard__cell--total">
                                                            <i>in</i>
                                                            <b>{inn}</b>
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </article>
                                );
                            })}
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
