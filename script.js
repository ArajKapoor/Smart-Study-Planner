// --- UI Elements ---
const numSubjectsInput = document.getElementById('numSubjects');
const subjectsContainer = document.getElementById('subjectsContainer');
const eventsContainer = document.getElementById('eventsContainer');
const addEventBtn = document.getElementById('addEventBtn');
const generateBtn = document.getElementById('generateBtn');
const resetBtn = document.getElementById('resetBtn');
const printBtn = document.getElementById('printBtn');
const errorMessage = document.getElementById('errorMessage');
const paceBanner = document.getElementById('paceBanner');
const timelineContainer = document.getElementById('timelineContainer');

// --- Setup Forms ---
function renderSubjectRows(count) {
    const currentValues = [];
    document.querySelectorAll('#subjectsContainer .subject-row').forEach(row => {
        currentValues.push({
            name: row.querySelector('.sub-name').value,
            tag: row.querySelector('.sub-tag').value,
            chapters: row.querySelector('.sub-chapters').value
        });
    });

    subjectsContainer.innerHTML = '';
    
    for(let i = 0; i < count; i++) {
        let nameVal = currentValues[i] ? currentValues[i].name : '';
        let tagVal = currentValues[i] ? currentValues[i].tag : 'medium';
        let chapVal = currentValues[i] ? currentValues[i].chapters : '10';
        
        const row = document.createElement('div');
        row.className = 'subject-row';
        row.innerHTML = `
            <div class="input-group">
                <input type="text" placeholder="Subject Name" class="sub-name" value="${nameVal}" required>
            </div>
            <div class="input-group">
                <select class="sub-tag">
                    <option value="strong" ${tagVal==='strong'?'selected':''}>Strong (Less Time)</option>
                    <option value="medium" ${tagVal==='medium'?'selected':''}>Medium (Normal)</option>
                    <option value="weak" ${tagVal==='weak'?'selected':''}>Weak (More Time)</option>
                </select>
            </div>
            <div class="input-group">
                <input type="number" placeholder="Chapters" class="sub-chapters" min="1" value="${chapVal}" required>
            </div>
        `;
        subjectsContainer.appendChild(row);
    }
}

renderSubjectRows(parseInt(numSubjectsInput.value) || 2);
numSubjectsInput.addEventListener('input', (e) => {
    let val = parseInt(e.target.value);
    if(val > 0 && val <= 30) renderSubjectRows(val);
});

addEventBtn.addEventListener('click', () => {
    const row = document.createElement('div');
    row.className = 'subject-row';
    row.innerHTML = `
        <div class="input-group">
            <input type="text" placeholder="Event Name (e.g. Lab)" class="ev-name" required>
        </div>
        <div class="input-group">
            <input type="time" class="ev-start" required>
        </div>
        <div class="input-group">
            <input type="time" class="ev-end" required>
        </div>
        <button class="btn btn-sm btn-danger" onclick="this.parentElement.remove()">X</button>
    `;
    eventsContainer.appendChild(row);
});

// Toggle custom time picker
const studyTimeSelect = document.getElementById('studyTime');
const customTimePicker = document.getElementById('customTimePicker');
studyTimeSelect.addEventListener('change', (e) => {
    if(e.target.value === 'custom') customTimePicker.classList.remove('hidden');
    else customTimePicker.classList.add('hidden');
});

// --- State for Adaptive Rescheduling ---
let masterScheduleState = null;

// --- Generation Logic ---

generateBtn.addEventListener('click', () => {
    generateMasterSchedule();
});

function generateMasterSchedule() {
    // 1. Gather Inputs
    const daysLeft = parseInt(document.getElementById('daysLeft').value);
    const numHolidays = parseInt(document.getElementById('numHolidays').value) || 0;
    const hoursPerDay = parseInt(document.getElementById('hoursPerDay').value);
    const timePref = document.getElementById('studyTime').value;
    const customTimeVal = document.getElementById('customTimePicker').value;
    const technique = document.getElementById('technique').value;
    
    if (numHolidays >= daysLeft) {
        showError("Holidays cannot exceed or equal Days Left.");
        return;
    }
    const studyDays = daysLeft - numHolidays;
    
    // Time config
    let studyMins = 25, breakMins = 5;
    if (technique === 'deepwork') { studyMins = 50; breakMins = 10; }
    if (technique === 'custom') { studyMins = 90; breakMins = 20; }
    
    let startHour = 8, startMin = 0;
    if (timePref === 'afternoon') startHour = 13;
    if (timePref === 'night') startHour = 20;
    if (timePref === 'custom' && customTimeVal) {
        const parts = customTimeVal.split(':');
        startHour = parseInt(parts[0]); startMin = parseInt(parts[1]);
    }
    
    // Fixed Events
    const events = [];
    document.querySelectorAll('#eventsContainer .subject-row').forEach(row => {
        const name = row.querySelector('.ev-name').value;
        const start = row.querySelector('.ev-start').value;
        const end = row.querySelector('.ev-end').value;
        if(name && start && end) {
            events.push({ name, start, end });
        }
    });

    // Subjects & Syllabus Decomposition
    const subjects = [];
    let totalWeight = 0;
    let paceHtml = '<strong>Syllabus Pace required:</strong><ul>';
    
    document.querySelectorAll('#subjectsContainer .subject-row').forEach(row => {
        const name = row.querySelector('.sub-name').value.trim();
        const tag = row.querySelector('.sub-tag').value;
        const chapters = parseInt(row.querySelector('.sub-chapters').value) || 1;
        
        if (name) {
            let weight = tag === 'weak' ? 3 : (tag === 'medium' ? 2 : 1);
            subjects.push({ name, weight, tag, sessionsNeeded: 0, sessionsDone: 0 });
            totalWeight += weight;
            
            let pace = (chapters / studyDays).toFixed(1);
            paceHtml += `<li>${name}: ${pace} chapters/day</li>`;
        }
    });
    paceHtml += '</ul>';

    if (subjects.length === 0) {
        showError("Please add at least one subject.");
        return;
    }

    // Hide form, show loading
    document.querySelector('.form-section').classList.add('hidden');
    document.getElementById('resultsSection').classList.remove('hidden');
    document.getElementById('loading').classList.remove('hidden');
    paceBanner.classList.add('hidden');
    timelineContainer.classList.add('hidden');
    
    setTimeout(() => {
        // Calculate total sessions
        const totalMinutesAvailable = studyDays * hoursPerDay * 60;
        const totalSessions = Math.floor(totalMinutesAvailable / (studyMins + breakMins));
        
        // Allocate sessions by weight
        subjects.forEach(sub => {
            sub.sessionsNeeded = Math.round((sub.weight / totalWeight) * totalSessions);
        });

        // Generate greedy exact-time schedule
        const schedule = buildTimeline(studyDays, startHour, startMin, hoursPerDay, studyMins, breakMins, subjects, events);
        
        masterScheduleState = {
            daysLeft, studyDays, startHour, startMin, hoursPerDay, studyMins, breakMins, subjects, events, schedule, holidaysCount: numHolidays
        };

        paceBanner.innerHTML = paceHtml;
        renderTimelineUI();
    }, 500);
}

function buildTimeline(studyDays, startHour, startMin, hoursPerDay, studyMins, breakMins, subjects, fixedEvents) {
    let schedule = [];
    let srQueue = {}; // Spaced Repetition Queue: dayIndex -> subjectName[]
    
    // Parse fixed events to minute offsets from midnight
    const parsedEvents = fixedEvents.map(e => {
        let sp = e.start.split(':'), ep = e.end.split(':');
        return {
            name: e.name,
            startMin: parseInt(sp[0])*60 + parseInt(sp[1]),
            endMin: parseInt(ep[0])*60 + parseInt(ep[1])
        };
    });

    for (let day = 0; day < studyDays; day++) {
        let dailySchedule = [];
        let currentDayMin = startHour * 60 + startMin;
        const endDayMin = currentDayMin + (hoursPerDay * 60);
        let continuousStudyMins = 0;
        
        while (currentDayMin < endDayMin) {
            // Check fixed events intersection
            let eventIntersect = parsedEvents.find(e => currentDayMin >= e.startMin && currentDayMin < e.endMin);
            if (eventIntersect) {
                dailySchedule.push({ type: 'fixed', name: eventIntersect.name, start: currentDayMin, end: eventIntersect.endMin });
                currentDayMin = eventIntersect.endMin;
                continuousStudyMins = 0;
                continue;
            }

            // Check Long Break Contextual Logic
            if (continuousStudyMins >= 180) {
                let brkEnd = currentDayMin + 30;
                if (brkEnd > endDayMin) brkEnd = endDayMin;
                dailySchedule.push({ type: 'longbreak', name: 'Long Rest', start: currentDayMin, end: brkEnd });
                currentDayMin = brkEnd;
                continuousStudyMins = 0;
                continue;
            }

            // Determine next subject
            let selectedSub = null;
            let isQuiz = false;
            let isReview = false;

            // 1. Spaced Repetition Queue check
            if (srQueue[day] && srQueue[day].length > 0) {
                let subName = srQueue[day].shift();
                selectedSub = subjects.find(s => s.name === subName);
                if(selectedSub) isReview = true;
            }

            // 2. Normal Priority check
            if (!selectedSub) {
                let available = subjects.filter(s => s.sessionsNeeded > 0).sort((a,b) => b.weight - a.weight);
                if (available.length > 0) {
                    selectedSub = available[0];
                }
            }

            if (!selectedSub) {
                // Done for the day or all subjects finished
                currentDayMin += 30; 
                continue;
            }

            // Active Recall Check
            if (!isReview && selectedSub.sessionsDone % 4 === 3) {
                isQuiz = true;
            }

            // Schedule block
            let blkEnd = currentDayMin + studyMins;
            if (blkEnd > endDayMin) blkEnd = endDayMin; // Cut short if day ending

            dailySchedule.push({
                type: 'study',
                subject: selectedSub.name,
                isReview, isQuiz,
                start: currentDayMin, end: blkEnd
            });
            
            selectedSub.sessionsNeeded--;
            selectedSub.sessionsDone++;
            continuousStudyMins += studyMins;
            currentDayMin = blkEnd;

            // Add Spaced Repetition triggers (Day 1, 3)
            if (!isReview && !isQuiz) {
                if(!srQueue[day+1]) srQueue[day+1] = []; srQueue[day+1].push(selectedSub.name);
                if(!srQueue[day+3]) srQueue[day+3] = []; srQueue[day+3].push(selectedSub.name);
            }

            // Standard Break
            if (currentDayMin < endDayMin) {
                let sbEnd = currentDayMin + breakMins;
                if (sbEnd > endDayMin) sbEnd = endDayMin;
                dailySchedule.push({ type: 'break', name: 'Short Break', start: currentDayMin, end: sbEnd });
                currentDayMin = sbEnd;
                // Short break doesn't reset long continuous study, just adds a tiny pause
            }
        }
        schedule.push(dailySchedule);
    }
    return schedule;
}

// --- Adaptive Rescheduling Logic ---
window.markIncomplete = function(dayIndex, eventIndex, subjectName) {
    if(!masterScheduleState) return;
    
    // Find subject
    let sub = masterScheduleState.subjects.find(s => s.name === subjectName);
    if(sub) {
        sub.sessionsNeeded += 1; // Add the session back
    }

    // Rebuild schedule starting from dayIndex
    // For simplicity, we keep the previous days exactly as they were, and rebuild the future.
    let pastSchedule = masterScheduleState.schedule.slice(0, dayIndex);
    let remainingStudyDays = masterScheduleState.studyDays - dayIndex;
    
    let futureSchedule = buildTimeline(
        remainingStudyDays, 
        masterScheduleState.startHour, masterScheduleState.startMin, 
        masterScheduleState.hoursPerDay, 
        masterScheduleState.studyMins, masterScheduleState.breakMins, 
        masterScheduleState.subjects, 
        masterScheduleState.events
    );

    masterScheduleState.schedule = pastSchedule.concat(futureSchedule);
    renderTimelineUI();
};

function renderTimelineUI() {
    const s = masterScheduleState;
    timelineContainer.innerHTML = '';
    
    const subjectColors = {};
    let colorIndex = 0;
    
    let totalDays = s.studyDays + s.holidaysCount;
    let holidayInterval = s.holidaysCount > 0 ? Math.floor(totalDays / s.holidaysCount) : totalDays + 1;
    let scheduleIndex = 0;

    for (let dayIndex = 0; dayIndex < totalDays; dayIndex++) {
        const dayDiv = document.createElement('div');
        dayDiv.className = 'timeline-day';
        
        let isHoliday = false;
        if (s.holidaysCount > 0 && ((dayIndex + 1) % (Math.ceil(totalDays / s.holidaysCount)) === 0)) {
            if (dayIndex - scheduleIndex < s.holidaysCount) isHoliday = true;
        }
        if (scheduleIndex >= s.studyDays) isHoliday = true;

        if (isHoliday) {
            dayDiv.innerHTML = `<h3>Day ${dayIndex + 1} - 🏖️ HOLIDAY</h3>
                <div class="tabloid-event tabloid-break" style="background:#f0fdf4; border-color:#86efac; color:#166534; font-size:1.2rem; padding:2rem;">
                    Enjoy your day off! Relax and recharge.
                </div>`;
            timelineContainer.appendChild(dayDiv);
            continue;
        }
        
        dayDiv.innerHTML = `<h3>Day ${dayIndex + 1}</h3>`;
        const daySchedule = s.schedule[scheduleIndex];
        
        daySchedule.forEach((ev, evIdx) => {
            let startStr = minsToTime(ev.start);
            let endStr = minsToTime(ev.end);

            if (ev.type === 'fixed') {
                dayDiv.innerHTML += `
                    <div class="tabloid-event tabloid-fixed">
                        <div class="tabloid-time">${startStr} - ${endStr}</div>
                        <div class="tabloid-subject">🔒 ${ev.name}</div>
                    </div>`;
            } else if (ev.type === 'break' || ev.type === 'longbreak') {
                let icon = ev.type === 'longbreak' ? '🍔' : '☕';
                dayDiv.innerHTML += `
                    <div class="tabloid-event tabloid-break">
                        <div class="tabloid-time">${startStr} - ${endStr}</div>
                        <div class="tabloid-subject">${icon} ${ev.name}</div>
                    </div>`;
            } else if (ev.type === 'study') {
                if (!subjectColors[ev.subject]) {
                    subjectColors[ev.subject] = `color-${colorIndex % 8}`;
                    colorIndex++;
                }
                const cClass = subjectColors[ev.subject];
                
                let extraClass = '';
                let label = ev.subject;
                if(ev.isReview) { extraClass = 'tabloid-review'; label = `🔄 Review: ${ev.subject}`; }
                if(ev.isQuiz) { extraClass = 'tabloid-quiz'; label = `📝 Quiz: ${ev.subject}`; }

                dayDiv.innerHTML += `
                    <div class="tabloid-event ${cClass} ${extraClass}">
                        <div class="tabloid-header">
                            <div class="tabloid-time">${startStr} - ${endStr}</div>
                            <button class="btn-incomplete" onclick="event.stopPropagation(); markIncomplete(${scheduleIndex}, ${evIdx}, '${ev.subject}')">Mark Incomplete</button>
                        </div>
                        <div class="tabloid-subject">${label}</div>
                    </div>`;
            }
        });
        
        scheduleIndex++;
        timelineContainer.appendChild(dayDiv);
    }

    // Attach click for mark completed
    document.querySelectorAll('.tabloid-event:not(.tabloid-break):not(.tabloid-fixed)').forEach(el => {
        el.addEventListener('click', function(e) {
            if(!e.target.classList.contains('btn-incomplete')) {
                this.classList.toggle('completed');
            }
        });
    });

    document.getElementById('loading').classList.add('hidden');
    paceBanner.classList.remove('hidden');
    timelineContainer.classList.remove('hidden');
    resetBtn.classList.remove('hidden');
    printBtn.classList.remove('hidden');
}

function minsToTime(mins) {
    let h = Math.floor(mins / 60) % 24;
    let m = mins % 60;
    let ampm = h >= 12 ? 'PM' : 'AM';
    let h12 = h % 12;
    if(h12 === 0) h12 = 12;
    return `${h12}:${m.toString().padStart(2, '0')} ${ampm}`;
}

function showError(msg) {
    document.getElementById('loading').classList.add('hidden');
    document.querySelector('.form-section').classList.remove('hidden');
    document.getElementById('resultsSection').classList.add('hidden');
    errorMessage.textContent = msg;
    errorMessage.classList.remove('hidden');
}

resetBtn.addEventListener('click', () => {
    document.getElementById('resultsSection').classList.add('hidden');
    document.querySelector('.form-section').classList.remove('hidden');
    resetBtn.classList.add('hidden');
    printBtn.classList.add('hidden');
    masterScheduleState = null;
});

printBtn.addEventListener('click', () => window.print());
