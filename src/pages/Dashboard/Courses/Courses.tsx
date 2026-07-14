import {useEffect, useState} from 'react'
import HttpService from "../../../services/HttpService.ts";

import "../../../styles/Pages/Courses.scss"
import "../../../styles/Shared/backgrounds.scss"
import AuthCrest from "../../../components/AuthCrest.tsx";
import golfBg from "../../../assets/golf-bg.jpg";
import toast from "react-simple-toasts";
import {getCurrentCoords} from "../../../utils/geo.ts";

interface Course {
    id: number;
    name: string;
    location: string | null;
    latitude: number | null;
    longitude: number | null;
    phone: string | null;
    distance_km: number | null;
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

// Cap how many tee dots render on a card; the rest collapse into a "+N" chip
const MAX_TEE_DOTS = 6;

const Courses = () => {
    const [courses, setCourses] = useState<Course[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    // null = not resolved yet, false = denied/unavailable, {lat,lng} = located
    const [coords, setCoords] = useState<{lat: number; lng: number} | null | false>(null);

    // Resolve the user's location once on mount, then load the nearest courses.
    // Works on web and native (Capacitor); resolves to false if unavailable/denied.
    useEffect(() => {
        let active = true;
        getCurrentCoords().then((c) => {
            if (active) setCoords(c ?? false);
        });
        return () => { active = false; };
    }, []);

    // Load courses whenever the search or resolved location changes (debounced)
    useEffect(() => {
        if (coords === null) return; // wait for the geolocation attempt to settle

        const handle = setTimeout(() => {
            const params: Record<string, string> = {};
            const q = searchQuery.trim();
            if (q) {
                params.search = q;
            } else if (coords) {
                params.lat = String(coords.lat);
                params.lng = String(coords.lng);
            } else {
                params.limit = '10'; // no location & no search → first 10 alphabetically
            }
            loadCourses(params);
        }, searchQuery.trim() ? 350 : 0); // debounce typing; load instantly otherwise

        return () => clearTimeout(handle);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchQuery, coords]);

    const loadCourses = async (params: Record<string, string>) => {
        setIsLoading(true);
        try {
            const httpService = new HttpService();
            const qs = new URLSearchParams(params).toString();
            const response = await httpService.get(`courses${qs ? `?${qs}` : ''}`);
            setCourses(response.data.data || []);
        } catch (error: any) {
            console.error("Error fetching courses:", error);
            toast("Failed to load courses", {className: "error-toast"});
        } finally {
            setIsLoading(false);
        }
    };

    // Pull the holes (ordered) from a course's first tee for the mini scorecard
    const getHoles = (course: Course): Hole[] => {
        const tee = course.tees?.[0];
        if (!tee?.holes?.length) return [];
        return [...tee.holes].sort((a, b) => a.hole_number - b.hole_number);
    };

    const sumPar = (holes: Hole[]): number => holes.reduce((total, h) => total + (h.par || 0), 0);

    // Google Maps link — prefer exact coords, fall back to a name/location search
    const mapsUrl = (course: Course): string | null => {
        if (course.latitude != null && course.longitude != null) {
            return `https://www.google.com/maps/search/?api=1&query=${course.latitude},${course.longitude}`;
        }
        const q = [course.name, course.location].filter(Boolean).join(' ');
        return q ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}` : null;
    };

    // Context-aware subtitle (search results vs nearest vs fallback)
    const subtitle = (() => {
        const n = courses.length;
        if (searchQuery.trim()) return `${n} result${n !== 1 ? 's' : ''} for "${searchQuery.trim()}"`;
        if (coords) return `${n} course${n !== 1 ? 's' : ''} nearest to you`;
        return `${n} course${n !== 1 ? 's' : ''}`;
    })();

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
                            <span className="clubhouse-header__sub">{subtitle}</span>
                        </div>
                    </header>

                    <div className="courses-toolbar">
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
                    </div>

                    {isLoading ? (
                        <div className="courses-grid">
                            {[0, 1, 2].map((i) => (
                                <div key={i} className="scorecard scorecard--skeleton" />
                            ))}
                        </div>
                    ) : courses.length === 0 ? (
                        <div className="courses-empty">
                            <div className="courses-empty__crest">
                                <AuthCrest />
                            </div>
                            <h3>{searchQuery ? 'No matches found' : 'No courses yet'}</h3>
                            <p>{searchQuery ? `Nothing in the clubhouse matches "${searchQuery}"` : 'Courses will appear here once they have been imported.'}</p>
                        </div>
                    ) : (
                        <div className="courses-grid">
                            {courses.map((course) => {
                                const holes = getHoles(course);
                                const front = holes.slice(0, 9);
                                const back = holes.slice(9, 18);
                                const par = sumPar(holes);
                                const out = sumPar(front);
                                const inn = sumPar(back);
                                const maps = mapsUrl(course);
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
                                                {course.phone && (
                                                    <a className="scorecard__phone" href={`tel:${course.phone.replace(/\s+/g, '')}`}>
                                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                                                             stroke="currentColor" strokeWidth="2" strokeLinecap="round"
                                                             strokeLinejoin="round">
                                                            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"></path>
                                                        </svg>
                                                        {course.phone}
                                                    </a>
                                                )}
                                            </div>
                                            <div className="scorecard__actions">
                                                {course.distance_km != null && (
                                                    <span className="scorecard__distance" title="Distance from you">
                                                        {course.distance_km} km
                                                    </span>
                                                )}
                                                {maps && (
                                                    <a
                                                        className="scorecard__btn"
                                                        href={maps}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        title="Open in Google Maps"
                                                        aria-label="Open in Google Maps"
                                                    >
                                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                                                             stroke="currentColor" strokeWidth="2" strokeLinecap="round"
                                                             strokeLinejoin="round">
                                                            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                                                            <circle cx="12" cy="10" r="3"></circle>
                                                        </svg>
                                                    </a>
                                                )}
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
                                                    {course.tees.slice(0, MAX_TEE_DOTS).map((t) => (
                                                        <span
                                                            key={t.id}
                                                            className="scorecard__tee-dot"
                                                            style={{backgroundColor: t.colour_code || '#ccc'}}
                                                        />
                                                    ))}
                                                    {course.tees.length > MAX_TEE_DOTS && (
                                                        <span className="scorecard__tee-more">+{course.tees.length - MAX_TEE_DOTS}</span>
                                                    )}
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
        </div>
    )
}
export default Courses
