import {useEffect, useState, useRef} from 'react'
import LocalDataService from "../../../services/LocalDataService.ts";

import "../../../styles/Pages/Courses.scss"
import "../../../styles/Shared/backgrounds.scss"
import AddCourseModal from "../../../components/AddCourseModal.tsx";
import ApiImportModal from "../../../components/ApiImportModal.tsx";
import golfBg from "../../../assets/golf-bg.jpg";

const Courses = () => {
    const [courseModalBool, setCourseModalBool] = useState(false);
    const [courseModalMode, setCourseModalMode] = useState<'add' | 'edit'>('add');
    const [selectedCourse, setSelectedCourse] = useState(null);
    const [courses, setCourses] = useState([]);
    const [showImportModal, setShowImportModal] = useState(false);
    const [importData, setImportData] = useState('');
    const [importError, setImportError] = useState('');
    const [exportSuccess, setExportSuccess] = useState(false);
    const [showApiImportModal, setShowApiImportModal] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const dataService = new LocalDataService();
        setCourses(dataService.getCourses());
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
        setCourses((old) => [...old, $event]);
        setCourseModalBool(false)
    }

    const handleCourseUpdated = ($event) => {
        setCourses((old) => old.map(course => course.id === $event.id ? $event : course));
        setCourseModalBool(false);
        setSelectedCourse(null);
    }

    const handleExportCourses = async () => {
        const dataService = new LocalDataService();
        const allCourses = dataService.getCourses();
        const jsonData = JSON.stringify(allCourses, null, 2);

        try {
            await navigator.clipboard.writeText(jsonData);
            setExportSuccess(true);
            setTimeout(() => setExportSuccess(false), 3000);
        } catch {
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = jsonData;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            setExportSuccess(true);
            setTimeout(() => setExportSuccess(false), 3000);
        }
    };

    const handleImportCourses = () => {
        setImportData('');
        setImportError('');
        setShowImportModal(true);
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                setImportData(event.target?.result as string);
            };
            reader.readAsText(file);
        }
    };

    const handleApiCourseImported = (course) => {
        setCourses((old) => [...old, course]);
    };

    const handleConfirmImport = () => {
        try {
            const parsedCourses = JSON.parse(importData);

            if (!Array.isArray(parsedCourses)) {
                setImportError('Invalid format: Expected an array of courses');
                return;
            }

            const dataService = new LocalDataService();
            let importedCount = 0;

            parsedCourses.forEach((course) => {
                // Validate course structure
                if (!course.name || !course.holes || !Array.isArray(course.holes)) {
                    return;
                }

                // Check if course with same name exists
                const existingCourses = dataService.getCourses();
                const exists = existingCourses.some(c => c.name === course.name);

                if (!exists) {
                    // Add course with proper structure (new id will be generated)
                    dataService.addCourse({
                        course_name: course.name,
                        holes: course.holes
                    });
                    importedCount++;
                }
            });

            // Refresh courses list
            setCourses(dataService.getCourses());
            setShowImportModal(false);
            setImportData('');
            setImportError('');

            if (importedCount === 0) {
                alert('No new courses imported (all courses already exist)');
            } else {
                alert(`Successfully imported ${importedCount} course(s)`);
            }
        } catch {
            setImportError('Invalid JSON format. Please check your data.');
        }
    };

    return (
        <div className="page-with-background">
            <div 
                className="page-background" 
                style={{ backgroundImage: `url(${golfBg})` }}
            />
            <div className="page-content">
                <div className="courses-container">
                    <div className="page-header-glass">
                        <h1>⛳ Courses</h1>
                        <span className="count-badge">{courses.length} course{courses.length !== 1 ? 's' : ''}</span>
                    </div>

                    <div className="action-bar">
                        <button className="button-primary" onClick={handleAddCourseClick}>
                            <span style={{marginRight: '8px'}}>➕</span> Add Course
                        </button>
                        <button className="button-secondary" onClick={handleExportCourses} title="Export to clipboard">
                            <span style={{marginRight: '8px'}}>{exportSuccess ? '✅' : '📋'}</span> 
                            {exportSuccess ? 'Copied!' : 'Export'}
                        </button>
                        <button className="button-secondary" onClick={handleImportCourses} title="Import from JSON">
                            <span style={{marginRight: '8px'}}>📥</span> Import
                        </button>
                        <button className="button-secondary" onClick={() => setShowApiImportModal(true)} title="Import from API">
                            <span style={{marginRight: '8px'}}>🌐</span> API
                        </button>
                    </div>

                    {courses.length === 0 ? (
                        <div className="empty-state-glass">
                            <div className="empty-icon">⛳</div>
                            <h3>No Courses Yet</h3>
                            <p>Add your first golf course to get started</p>
                        </div>
                    ) : (
                        <div className="courses-grid">
                            {courses.map((course) => (
                                <div key={course.id} className="course-card glass-card">
                                    <div className="card-header">
                                        <div className="course-icon">⛳</div>
                                        <div className="course-info">
                                            <div className="course-name">{course.name}</div>
                                            <div className="course-meta">{course.holes.length} holes</div>
                                        </div>
                                    </div>
                                    <div className="card-actions">
                                        <button 
                                            className="action-btn edit" 
                                            onClick={() => handleEditCourseClick(course)}
                                            title="Edit course"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                                            </svg>
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {showImportModal && (
                <div className="modal-container">
                    <div className="modal-content">
                        <div className="modal-header">
                            <h3>Import Courses</h3>
                            <button className="close-button" onClick={() => setShowImportModal(false)}>&times;</button>
                        </div>
                        <p className="modal-description">
                            Paste JSON data or select a file to import courses.
                        </p>
                        <input
                            type="file"
                            ref={fileInputRef}
                            accept=".json"
                            onChange={handleFileSelect}
                            className="file-input-hidden"
                        />
                        <button
                            className="button-secondary file-select-button"
                            onClick={() => fileInputRef.current?.click()}
                        >
                            <span style={{marginRight: '8px'}}>📁</span> Select JSON File
                        </button>
                        <textarea
                            className="import-textarea"
                            value={importData}
                            onChange={(e) => setImportData(e.target.value)}
                            placeholder="Or paste JSON here..."
                        />
                        {importError && (
                            <p className="modal-error">{importError}</p>
                        )}
                        <div className="modal-actions">
                            <button
                                className="button-secondary"
                                onClick={() => setShowImportModal(false)}
                            >
                                Cancel
                            </button>
                            <button
                                className="button-primary"
                                onClick={handleConfirmImport}
                                disabled={!importData.trim()}
                            >
                                Import
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {courseModalBool && <AddCourseModal
                mode={courseModalMode}
                course={selectedCourse}
                onCloseModal={handleCloseModalClick}
                onCourseAdded={handleCourseAdded}
                onCourseUpdated={handleCourseUpdated}
            ></AddCourseModal>}

            {showApiImportModal && <ApiImportModal
                onClose={() => setShowApiImportModal(false)}
                onCourseImported={handleApiCourseImported}
            />}
        </div>
    )
}
export default Courses
