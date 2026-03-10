import {useEffect, useState, useRef} from 'react'
import LocalDataService from "../../../services/LocalDataService.ts";

import "../../../styles/Pages/Courses.scss"
import AddCourseModal from "../../../components/AddCourseModal.tsx";
import ApiImportModal from "../../../components/ApiImportModal.tsx";

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
        <>
            <div className="courses-container">
                <div className="table-container">
                    <div className="table-header">
                        <div className="table-cell">Name</div>
                        <div className="table-cell">Actions</div>
                    </div>
                    {courses.map((course, index) => (
                        <div key={index} className="table-row">
                            <div className="table-cell">{course.name}</div>
                            <div className="table-cell">
                                <button className="button-secondary"
                                        onClick={() => handleEditCourseClick(course)}>Edit
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
                <div className="action-buttons">
                    <button className="button-primary" onClick={handleAddCourseClick}>Add course</button>
                    <button className="button-secondary m-left-8" onClick={handleExportCourses}>
                        {exportSuccess ? 'Copied!' : 'Export'}
                    </button>
                    <button className="button-secondary m-left-8" onClick={handleImportCourses}>Import</button>
                    <button className="button-secondary m-left-8" onClick={() => setShowApiImportModal(true)}>API Import</button>
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
                            Select JSON File
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

        </>
    )

}
export default Courses
