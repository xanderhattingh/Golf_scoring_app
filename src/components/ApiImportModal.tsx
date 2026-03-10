import { useState } from 'react';
import GolfCourseApiService, { type ApiCourse } from '../services/GolfCourseApiService';
import LocalDataService from '../services/LocalDataService';

import '../styles/Components/modal.scss';

interface ApiImportModalProps {
    onClose: () => void;
    onCourseImported: (course: unknown) => void;
}

const ApiImportModal = ({ onClose, onCourseImported }: ApiImportModalProps) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<ApiCourse[]>([]);
    const [selectedCourse, setSelectedCourse] = useState<ApiCourse | null>(null);
    const [isSearching, setIsSearching] = useState(false);
    const [isImporting, setIsImporting] = useState(false);
    const [error, setError] = useState('');

    const handleSearch = async () => {
        if (!searchQuery.trim()) return;

        setIsSearching(true);
        setError('');
        setSearchResults([]);
        setSelectedCourse(null);

        try {
            const results = await GolfCourseApiService.searchCourses(searchQuery);
            setSearchResults(results);
            if (results.length === 0) {
                setError('No courses found. Try a different search term.');
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to search courses');
        } finally {
            setIsSearching(false);
        }
    };

    const handleImport = async () => {
        if (!selectedCourse) return;

        setIsImporting(true);
        setError('');

        try {
            // Find the best white tee
            const whiteTee = GolfCourseApiService.findBestWhiteTee(selectedCourse);
            
            if (!whiteTee) {
                setError('No white tees found for this course. Please select a different course.');
                setIsImporting(false);
                return;
            }

            // Transform API data to our format
            const holes = whiteTee.holes.map((hole, index) => ({
                hole_number: index + 1,
                hole_par: hole.par,
                hole_stroke: index + 1, // Default stroke index to hole number
            }));

            // Ensure we have 18 holes
            while (holes.length < 18) {
                holes.push({
                    hole_number: holes.length + 1,
                    hole_par: 4,
                    hole_stroke: holes.length + 1,
                });
            }

            const dataService = new LocalDataService();
            const newCourse = dataService.addCourse({
                course_name: selectedCourse.course_name,
                holes: holes.slice(0, 18),
            });

            onCourseImported(newCourse);
            onClose();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to import course');
        } finally {
            setIsImporting(false);
        }
    };

    const formatLocation = (course: ApiCourse) => {
        const loc = course.location;
        const parts = [loc?.city, loc?.state, loc?.country].filter(Boolean);
        return parts.length > 0 ? parts.join(', ') : '';
    };

    const getWhiteTeeInfo = (course: ApiCourse) => {
        const whiteTee = GolfCourseApiService.findBestWhiteTee(course);
        if (!whiteTee) return 'No white tees';
        return `${whiteTee.tee_name} (Par ${whiteTee.par_total})`;
    };

    return (
        <div className="modal-container">
            <div className="modal-content">
                <div className="modal-header">
                    <h3>Import from API</h3>
                    <button className="close-button" onClick={onClose}>&times;</button>
                </div>

                <p className="modal-description">
                    Search for a golf course to import hole pars from the white tees.
                    Stroke index will default to hole number - edit the course to set correct values.
                </p>

                <div className="search-row">
                    <input
                        type="text"
                        className="search-input"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                        placeholder="Enter course name..."
                    />
                    <button
                        className="button-primary"
                        onClick={handleSearch}
                        disabled={isSearching || !searchQuery.trim()}
                    >
                        {isSearching ? 'Searching...' : 'Search'}
                    </button>
                </div>

                {error && <p className="modal-error">{error}</p>}

                {searchResults.length > 0 && (
                    <div className="search-results">
                        {searchResults.map((course) => (
                            <div
                                key={course.id}
                                className={`search-result-item ${selectedCourse?.id === course.id ? 'selected' : ''}`}
                                onClick={() => setSelectedCourse(course)}
                            >
                                <div className="result-name">{course.course_name}</div>
                                {formatLocation(course) && (
                                    <div className="result-location">{formatLocation(course)}</div>
                                )}
                                <div className="result-tee-info">{getWhiteTeeInfo(course)}</div>
                            </div>
                        ))}
                    </div>
                )}

                <div className="modal-actions">
                    <button className="button-secondary" onClick={onClose}>
                        Cancel
                    </button>
                    <button
                        className="button-primary"
                        onClick={handleImport}
                        disabled={!selectedCourse || isImporting}
                    >
                        {isImporting ? 'Importing...' : 'Import'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ApiImportModal;
