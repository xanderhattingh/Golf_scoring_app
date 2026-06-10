const API_BASE_URL = 'https://api.golfcourseapi.com/v1';
const API_KEY = import.meta.env.VITE_GOLF_COURSE_API_KEY;

export interface ApiHole {
    par: number;
    yardage: number;
}

export interface ApiTee {
    tee_name: string;
    course_rating: number;
    slope_rating: number;
    par_total: number;
    total_yards: number;
    total_meters: number;
    number_of_holes: number;
    holes: ApiHole[];
}

export interface ApiCourseLocation {
    city?: string;
    state?: string;
    country?: string;
}

export interface ApiCourse {
    id: number;
    club_name: string;
    course_name: string;
    location: ApiCourseLocation;
    tees: {
        male: ApiTee[];
        female: ApiTee[];
    };
}

export interface ApiSearchResponse {
    courses: ApiCourse[];
}

class GolfCourseApiService {
    private async request<T>(endpoint: string): Promise<T> {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
            headers: {
                'Authorization': `Key ${API_KEY}`,
                'Content-Type': 'application/json',
            },
        });

        if (!response.ok) {
            throw new Error(`API Error: ${response.status} ${response.statusText}`);
        }

        return response.json();
    }

    async searchCourses(searchQuery: string): Promise<ApiCourse[]> {
        const encodedQuery = encodeURIComponent(searchQuery);
        const data = await this.request<ApiSearchResponse>(
            `/search?search_query=${encodedQuery}`
        );
        return data.courses || [];
    }

    /**
     * Find the best tee of a specific color from male tees.
     * Prefers "Color Re-Rate X" with the highest number, falls back to plain "Color".
     */
    findBestTeeByColor(course: ApiCourse, color: string): ApiTee | null {
        const maleTees = course.tees?.male || [];
        const colorLower = color.toLowerCase();
        
        // Find all tees of this color (case-insensitive, starts with color name)
        const colorTees = maleTees.filter(tee => 
            tee.tee_name.toLowerCase().startsWith(colorLower)
        );

        if (colorTees.length === 0) {
            return null;
        }

        // Sort by Re-Rate number (highest first), then plain color last
        const sorted = colorTees.sort((a, b) => {
            const aMatch = a.tee_name.match(/re-rate\s*(\d+)/i);
            const bMatch = b.tee_name.match(/re-rate\s*(\d+)/i);
            
            const aNum = aMatch ? parseInt(aMatch[1], 10) : -1;
            const bNum = bMatch ? parseInt(bMatch[1], 10) : -1;
            
            return bNum - aNum; // Higher numbers first
        });

        return sorted[0];
    }

    /**
     * Find the best white tee from male tees.
     * Prefers "White Re-Rate X" with the highest number, falls back to plain "White".
     * @deprecated Use findBestTeeByColor instead
     */
    findBestWhiteTee(course: ApiCourse): ApiTee | null {
        return this.findBestTeeByColor(course, 'white');
    }

    /**
     * Get all available color tees for a course.
     * Returns a map of color -> tee data for colors that exist.
     * @deprecated Use getAllColorTeesDynamic instead for full color support
     */
    getAllColorTees(course: ApiCourse): Record<string, ApiTee> {
        const colors = ['yellow', 'white', 'red', 'blue'];
        const result: Record<string, ApiTee> = {};
        
        for (const color of colors) {
            const tee = this.findBestTeeByColor(course, color);
            if (tee) {
                result[color] = tee;
            }
        }
        
        return result;
    }

    /**
     * Dynamically detect all color tees from male tees.
     * Extracts the first word of each tee name as the color key.
     * Returns a map of color -> tee data for colors that exist.
     */
    getAllColorTeesDynamic(course: ApiCourse): Record<string, ApiTee> {
        const maleTees = course.tees?.male || [];
        const colors = new Set<string>();
        
        for (const tee of maleTees) {
            const match = tee.tee_name.match(/^([A-Za-z]+)/);
            if (match) {
                colors.add(match[1].toLowerCase());
            }
        }
        
        const result: Record<string, ApiTee> = {};
        for (const color of colors) {
            const tee = this.findBestTeeByColor(course, color);
            if (tee) {
                result[color] = tee;
            }
        }
        
        return result;
    }
}

export default new GolfCourseApiService();
