/**
 * Career Statistics Calculation Service
 * 
 * Dedicated service for calculating career statistics from Apollo enrichment data.
 * Handles various date formats and field names that Apollo might return.
 */

export interface EmploymentRecord {
  // Apollo might use different field names - handle all variations
  started_at?: string;
  started_on?: string;
  start_date?: string;
  startDate?: string;
  ended_at?: string | null;
  ended_on?: string | null;
  end_date?: string | null;
  endDate?: string | null;
  title?: string;
  organization?: {
    name?: string;
  };
  company?: string;
  company_name?: string;
}

export interface CareerStats {
  currentTenureYears: number;
  totalExperienceYears: number;
  avgTenureYears: number;
  numberOfJobs: number;
  validJobs: number;
}

/**
 * Parse a date string, handling various formats Apollo might return
 * Returns a valid Date object or null if invalid
 */
function parseDate(dateString: string | null | undefined): Date | null {
  if (!dateString || typeof dateString !== 'string' || dateString.trim() === '') {
    return null;
  }
  
  // Try parsing the date
  const date = new Date(dateString);
  
  // Check if date is valid
  if (isNaN(date.getTime())) {
    return null;
  }
  
  return date;
}

/**
 * Extract start date from an employment record, handling various field names
 */
function getStartDate(job: EmploymentRecord): Date | null {
  const startDateStr = 
    job.started_at || 
    job.started_on || 
    job.start_date || 
    job.startDate;
  
  return parseDate(startDateStr);
}

/**
 * Extract end date from an employment record, handling various field names
 */
function getEndDate(job: EmploymentRecord): Date | null {
  const endDateStr = 
    job.ended_at || 
    job.ended_on || 
    job.end_date || 
    job.endDate;
  
  return parseDate(endDateStr);
}

/**
 * Check if a job is the current role (no end date)
 */
function isCurrentRole(job: EmploymentRecord): boolean {
  const endDate = getEndDate(job);
  return endDate === null && getStartDate(job) !== null;
}

/**
 * Calculate months between two dates
 */
function calculateMonths(startDate: Date, endDate: Date): number {
  const diffTime = endDate.getTime() - startDate.getTime();
  const diffMonths = diffTime / (1000 * 60 * 60 * 24 * 30);
  return Math.max(0, diffMonths);
}

/**
 * Calculate comprehensive career statistics from employment history
 * 
 * @param employmentHistory - Array of employment records from Apollo
 * @returns CareerStats object with calculated metrics
 */
export function calculateCareerStats(
  employmentHistory?: EmploymentRecord[] | null
): CareerStats {
  // Default return values
  const defaultStats: CareerStats = {
    currentTenureYears: 0,
    totalExperienceYears: 0,
    avgTenureYears: 0,
    numberOfJobs: 0,
    validJobs: 0,
  };

  if (!employmentHistory || employmentHistory.length === 0) {
    console.log('⚠️ CareerStatsService: No employment history provided');
    return defaultStats;
  }

  console.log(`📊 CareerStatsService: Processing ${employmentHistory.length} employment records`);
  
  // Log first record structure for debugging
  if (employmentHistory.length > 0) {
    console.log('📅 First employment record structure:', JSON.stringify(employmentHistory[0], null, 2));
  }

  const now = new Date();
  let currentTenureYears = 0;
  let totalMonths = 0;
  let validJobs = 0;

  // Find current role (no end date) and calculate current tenure
  const currentRole = employmentHistory.find(job => isCurrentRole(job));
  if (currentRole) {
    const startDate = getStartDate(currentRole);
    if (startDate) {
      const months = calculateMonths(startDate, now);
      if (!isNaN(months) && months > 0) {
        currentTenureYears = months / 12;
        console.log(`✅ Current tenure calculated: ${currentTenureYears.toFixed(2)} years (start: ${startDate.toISOString()})`);
      } else {
        console.log(`⚠️ Invalid current tenure calculation (months: ${months})`);
      }
    } else {
      console.log('⚠️ Current role found but no valid start date');
    }
  } else {
    console.log('⚠️ No current role found (all jobs have end dates)');
  }

  // Calculate total experience and average tenure
  for (const job of employmentHistory) {
    const startDate = getStartDate(job);
    if (!startDate) {
      console.log(`⚠️ Skipping job with invalid start date:`, JSON.stringify(job));
      continue;
    }

    const endDate = getEndDate(job) || now;
    const months = calculateMonths(startDate, endDate);
    
    if (!isNaN(months) && months > 0) {
      totalMonths += months;
      validJobs++;
      console.log(`✅ Job ${validJobs}: ${months.toFixed(2)} months (${startDate.toISOString()} to ${endDate.toISOString()})`);
    } else {
      console.log(`⚠️ Skipping job with invalid duration (months: ${months}):`, JSON.stringify(job));
    }
  }

  const totalExperienceYears = totalMonths / 12;
  const avgTenureYears = validJobs > 0 ? totalMonths / validJobs / 12 : 0;

  const stats: CareerStats = {
    currentTenureYears: Math.round(currentTenureYears * 10) / 10,
    totalExperienceYears: Math.round(totalExperienceYears * 10) / 10,
    avgTenureYears: Math.round(avgTenureYears * 10) / 10,
    numberOfJobs: employmentHistory.length,
    validJobs,
  };

  console.log('📈 CareerStatsService final results:', stats);
  
  return stats;
}

/**
 * Calculate tenure years at current company (backward compatibility)
 * 
 * @param employmentHistory - Array of employment records
 * @returns number - Years of tenure at current company
 */
export function calculateTenureYears(
  employmentHistory?: EmploymentRecord[] | null
): number {
  if (!employmentHistory || employmentHistory.length === 0) {
    return 0;
  }

  const currentRole = employmentHistory.find(job => isCurrentRole(job));
  if (!currentRole) {
    return 0;
  }

  const startDate = getStartDate(currentRole);
  if (!startDate) {
    return 0;
  }

  const now = new Date();
  const years = calculateMonths(startDate, now) / 12;
  
  if (isNaN(years)) {
    return 0;
  }
  
  return Math.max(0, Math.round(years * 10) / 10);
}

