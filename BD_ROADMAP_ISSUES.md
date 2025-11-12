# BD Roadmap Issues & Requirements

## 🚨 Current Problems

### 1. **Hardcoded Data**
- Has `INITIAL_ITEMS` array with 5 hardcoded tasks
- No database integration
- No API calls
- Just static JavaScript array

### 2. **localStorage Only**
- Stores items in browser localStorage
- Not persisted in database
- Lost when user clears browser data
- Not shared across devices

### 3. **No Connection to Real Data**
- Doesn't pull from campaigns
- Doesn't pull from events
- Doesn't pull from meetings
- No connection to scheduled activities

### 4. **Wrong Purpose**
- Currently: Task checklist system
- Should be: Timeline/calendar showing scheduled activities
- Should show: When emails go out, when events happen, 12-month plan

## ✅ What BD Roadmap SHOULD Be

### Dynamic Timeline/Calendar View

**BD Roadmap** should show a **visual timeline** of scheduled BD activities:

1. **Scheduled Campaigns**
   - When email campaigns are scheduled to send
   - Campaign send dates on timeline
   - Multi-touch sequences visualized
   - Email cadence over time

2. **Events Timeline**
   - Events scheduled by month
   - 12-month plan: "By month 6 we want these events"
   - Quarterly events
   - Annual events
   - Event planning timeline

3. **Meetings Schedule**
   - Scheduled meetings on calendar
   - Meeting cadence
   - Recurring meetings

4. **12-Month Strategic Plan**
   - Long-term BD plan
   - Activities by month
   - Milestones and goals
   - Strategic initiatives

5. **Activity Calendar**
   - Calendar view of all BD activities
   - Timeline view of scheduled items
   - Gantt chart style visualization
   - Month-by-month breakdown

## 📊 Data Sources

BD Roadmap should pull from:

1. **Campaigns** (`/api/campaigns`)
   - `scheduledFor` date
   - Campaign send dates
   - Multi-touch sequence dates
   - Email send schedule

2. **Events** (`/api/events`)
   - Event dates
   - Event planning timeline
   - Quarterly/annual events

3. **Meetings** (`/api/meetings`)
   - Meeting dates
   - Recurring meetings
   - Meeting cadence

4. **Roadmap Items** (new database model)
   - Strategic initiatives
   - Milestones
   - Long-term goals
   - 12-month plan items

## 🗄️ Database Model Needed

```prisma
model RoadmapItem {
  id            String   @id @default(cuid())
  companyHQId   String   @map("company_hq_id")
  title         String
  description   String?
  type          String   // 'campaign', 'event', 'meeting', 'milestone', 'goal'
  scheduledFor  DateTime? // When it's scheduled
  month         Int?     // Target month (1-12)
  quarter       Int?     // Target quarter (1-4)
  year          Int?     // Target year
  phase         String?  // 'Foundation', 'Acceleration', 'Scale', 'Optimize'
  status        String   @default("planned") // 'planned', 'scheduled', 'in-progress', 'completed'
  priority      String?  // 'P0', 'P1', 'P2'
  recurring     Boolean  @default(false)
  
  // References to actual items
  campaignId    String?  @map("campaign_id")
  eventId       String?  @map("event_id")
  meetingId     String?  @map("meeting_id")
  
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  
  companyHQ     CompanyHQ @relation(fields: [companyHQId], references: [id])
  campaign      Campaign? @relation(fields: [campaignId], references: [id])
  event         Event?    @relation(fields: [eventId], references: [id])
  meeting       Meeting?  @relation(fields: [meetingId], references: [id])
  
  @@map("roadmap_items")
}
```

## 🔄 Implementation Plan

### Phase 1: Remove Hardcoded Data
1. Remove `INITIAL_ITEMS` array
2. Remove localStorage dependency
3. Create database model for RoadmapItem
4. Create API endpoint `/api/roadmap`

### Phase 2: Connect to Real Data
1. Pull scheduled campaigns
2. Pull scheduled events
3. Pull scheduled meetings
4. Aggregate timeline data

### Phase 3: Create Timeline View
1. Calendar view component
2. Timeline/Gantt chart component
3. 12-month plan view
4. Month-by-month breakdown

### Phase 4: Roadmap Builder
1. UI to create roadmap items
2. Link campaigns to roadmap
3. Link events to roadmap
4. Link meetings to roadmap
5. Plan 12-month strategic initiatives

## 🎯 User Stories

1. **As a BD manager**, I want to see when all my email campaigns are scheduled to go out, so I can plan my outreach strategy.

2. **As a BD manager**, I want to see a 12-month plan showing events by month (e.g., "by month 6 we want these events"), so I can plan long-term.

3. **As a BD manager**, I want to see a timeline of all BD activities (campaigns, events, meetings), so I can visualize my BD plan.

4. **As a BD manager**, I want to create roadmap items and schedule them for specific months, so I can plan strategic initiatives.

5. **As a BD manager**, I want the roadmap to automatically pull from scheduled campaigns and events, so I don't have to manually update it.

## 📝 Notes

- **Current**: Hardcoded task checklist ❌
- **Should Be**: Dynamic timeline showing scheduled activities ✅
- **Data Source**: Campaigns, Events, Meetings, Roadmap Items
- **View**: Calendar/Timeline/Gantt chart
- **Time Range**: 12-month view with month-by-month breakdown

