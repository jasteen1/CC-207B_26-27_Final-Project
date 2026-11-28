// Prototype data. Sources:
// - Schedule: the student's WVSU Student Class Schedule, SY 2026–2027 1st Semester (7 subjects, 15 weekly meetings),
//   checked against the subject table AND the weekly grid. Personal identifiers are removed from the image.
// - Buildings, floors, offices, rooms: the project's blueprint records (supabase/drafts/blueprint_rooms_draft.sql)
//   and the verified QH 1 pilot (supabase/drafts/pilot_quezon_hall_qh1.sql). Only QH 1 has verified room geometry.
// - Building outlines: the team's MapTiler "Wayfinder" dataset (campus.js).
export const WF: any = {
  student: { first: "Juan", last: "Dela Cruz", email: "juan.delacruz@wvsu.edu.ph", personal: "juan.delacruz@gmail.com" },
  // Sample room change delivered with the class reminder: today's CIT 251 meets in QH 1 instead of ICT 305.
  // The student is still in CICT (CIT 213 ends at 10:00), so the reminder offers the CICT → Quezon Hall walk.
  reminderDemo: { code: "CIT 251", meeting: 1, room: "QH 1", from: "cict-building", at: 9 * 60 + 45 },
  // Profile setup after sign-in: colleges and their programs (WVSU La Paz main campus), and campuses.
  colleges: [
    { id: "cict", name: "College of Information and Communications Technology", short: "CICT", programs: ["BS Information Technology", "BS Computer Science", "BS Information Systems", "BS Entertainment and Multimedia Computing", "Bachelor of Library and Information Science"] },
    { id: "cas", name: "College of Arts and Sciences", short: "CAS", programs: ["BS Biology", "BS Chemistry", "BS Mathematics", "BS Psychology", "AB Political Science", "AB English Language Studies"] },
    { id: "cbm", name: "College of Business and Management", short: "CBM", programs: ["BS Accountancy", "BS Business Administration", "BS Hospitality Management", "BS Tourism Management"] },
    { id: "coc", name: "College of Communication", short: "CoC", programs: ["AB Communication"] },
    { id: "coe", name: "College of Education", short: "COE", programs: ["Bachelor of Elementary Education", "Bachelor of Secondary Education", "Bachelor of Early Childhood Education"] },
    { id: "pescar", name: "College of PESCAR", short: "PESCAR", programs: ["Bachelor of Physical Education", "BS Exercise and Sports Sciences"] },
    { id: "con", name: "College of Nursing", short: "CON", programs: ["BS Nursing"] },
    { id: "com", name: "College of Medicine", short: "COM", programs: ["Doctor of Medicine"] },
    { id: "cod", name: "College of Dentistry", short: "COD", programs: ["Doctor of Dental Medicine"] },
    { id: "col", name: "College of Law", short: "COL", programs: ["Juris Doctor"] },
  ],
  campuses: ["La Paz (main campus)", "Calinog", "Himamaylan", "Janiuay", "Lambunao", "Pototan"],
  // People tab placeholder: the first 10 entries of WVSU's Directory of Officials (https://wvsu.edu.ph/directory),
  // copied 27 Nov 2026. Emails are hidden on that page, and it lists no office rooms.
  peopleSource: { url: "https://wvsu.edu.ph/directory", checked: "27 Nov 2026" },
  people: [
    { name: "Joselito F. Villaruz", cred: "MD, PhD, FPPS", role: "SUC President IV", unit: "Office of the President", phone: "(033) 320-0870 to 77 loc. 1101 & 1102", tel: "+63333200870" },
    { name: "Ma. Asuncion Christine V. Dequilla", cred: "PhD", role: "Vice President for Academic Affairs", unit: "VPAA", phone: "(033) 320-0870 to 77 loc. 1128–1129", tel: "+63333200870" },
    { name: "Peter Ernie D. Paris", cred: "RMT, PhD", role: "Vice President for Administration and Finance", unit: "VPAF", phone: "(033) 320-0870 to 77 loc. 1134–1135", tel: "+63333200870" },
    { name: "Victorino A. Salcedo III", cred: "MD, MPG, FPCS, FPSGS", role: "Vice President for Medical and Allied Sciences", unit: "VPMAS", phone: "(033) 320-2431 to 38 loc. 502", tel: "+63333202431" },
    { name: "Greta G. Gabinete", cred: "PhD", role: "Vice President for Research, Innovation, and Extension", unit: "VPRIE", phone: "(033) 320-0870 to 77 loc. 1126–1127", tel: "+63333200870" },
    { name: "Nona P. Salvio", cred: "LPT, JD", role: "Board of Regents Secretary", unit: "BOR Secretary Office", phone: "(033) 320-0870 to 77 loc. 1901–1902", tel: "+63333200870" },
    { name: "Ruth A. Florentino", cred: "JD", role: "Head", unit: "University Legal Office", phone: null, tel: null },
    { name: "Regielyn L. Canja", cred: "CPA, MPA", role: "Director", unit: "Internal Audit Services", phone: "(033) 320-0870 to 77 loc. 1123–1124", tel: "+63333200870" },
    { name: "Ian Van V. Sumagaysay", cred: "RN, MAN", role: "Director", unit: "University Disaster Risk Reduction Management Council", phone: "(033) 320-0870 to 77 loc. 1910", tel: "+63333200870" },
    { name: "Alona M. Belarga", cred: "PhD", role: "Concurrent Director", unit: "Quality Assurance Office", phone: null, tel: null },
  ],
  // Simulated clock for the prototype: Wednesday, 6:40 AM (see HANDOFF.md).
  today: { day: 3, minutes: 6 * 60 + 40 },
  days: ["", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
  schedule: [
    { code: "CC 207B", title: "Applications Development and Emerging Technologies", row: 160, m: [[2, "9:00 AM", "12:00 PM", "ICT 307"], [4, "10:00 AM", "12:00 PM", "ICT 307"]] },
    { code: "CIT 213", title: "Human Computer Interaction 2", row: 173, m: [[1, "7:00 AM", "9:00 AM", "ICT 106"], [3, "7:00 AM", "10:00 AM", "ICT 306"]] },
    { code: "CC 208", title: "Methods of Research in Computing", row: 186, m: [[1, "4:00 PM", "5:30 PM", "ICT 106"], [3, "4:00 PM", "5:30 PM", "ICT 106"]] },
    { code: "CIT 212", title: "Networking 2 (Advanced Networking)", row: 199, m: [[1, "3:00 PM", "4:00 PM", "ICT 207"], [2, "4:00 PM", "6:00 PM", "ICT 305"], [4, "4:00 PM", "6:00 PM", "ICT 305"]] },
    { code: "CIT 251", title: "Security Compliance and Governance", row: 212, m: [[1, "9:00 AM", "12:00 PM", "ICT 305"], [3, "10:00 AM", "12:00 PM", "ICT 305"]] },
    { code: "BA 234", title: "Technopreneurship", row: 224, m: [[2, "1:00 PM", "2:30 PM", "ICT 107"], [4, "1:00 PM", "2:30 PM", "ICT 107"]] },
    { code: "CIT 210", title: "Web Systems and Technologies", row: 237, m: [[1, "1:00 PM", "3:00 PM", "ICT 307"], [3, "1:00 PM", "4:00 PM", "ICT 307"]] },
  ],
  places: {
    "quezon-hall": {
      name: "Quezon Hall", shape: "Quezon Hall", kind: "Building", floors: [1, 2],
      about: "Classrooms QH 1–6 and faculty offices on Floor 1.",
      entrance: "approximate", // approved map estimate; not on a surveyed walkway
      plans: { 1: { src: "assets/qh-floor-1.png", w: 1544, h: 580 }, 2: { src: "assets/qh-floor-2.png", w: 1544, h: 480 } },
      rooms: { "QH 1": { floor: 1, verified: true, rect: [0.2157, 0.0207, 0.0997, 0.5138], where: "Floor 1, next to the restrooms near the west stairs" } },
    },
    "cict-building": {
      name: "CICT Building", shape: "CICT Building", kind: "Building", floors: [1, 2, 3],
      about: "College of Information and Communications Technology. ICT rooms on Floors 1–3.",
      entrance: "none",
      rooms: {}, // ICT room positions exist only in an unverified blueprint draft
    },
    administration: {
      name: "Administration Building", shape: "Administration", kind: "Building", floors: [1, 2],
      about: "Registrar, admissions, payments, finance and the President’s office.",
      entrance: "none", rooms: {},
    },
    // Shown as Student’s Center (the map dataset still calls the outline "Hometel"; searching "Hometel" still finds it).
    hometel: { name: "Student’s Center", aka: ["hometel"], shape: "Hometel", kind: "Building", floors: [1, 2, 3], about: "Student services and student government: clinic, guidance, USC, OSA, CAS-SC and the sports office.", entrance: "approximate", rooms: {} },
    library: { name: "Library", shape: "Library", kind: "Building", floors: [], about: null, entrance: "none", rooms: {} },
    "rizal-hall": { name: "Rizal Hall", shape: "Rizal Hall", kind: "Building", floors: [], about: null, entrance: "none", rooms: {} },
  },
  offices: {
    registrar: {
      name: "Registrar’s Office", place: "administration", floor: 1, keywords: ["registrar", "transcript", "tor", "records", "credentials"],
      services: ["transcript"],
      // Reporting line as provided by the team; the official chart is linked for confirmation.
      reportsTo: ["Board of Regents", "Office of the President", "Office of the Vice President for Academic Affairs", "Registrar’s Office"],
    },
    admission: { name: "Admission Office", place: "administration", floor: 1 },
    payments: { name: "Payments", place: "administration", floor: 1 },
    finance: { name: "Finance Division", place: "administration", floor: 1 },
    president: { name: "Office of the President", place: "administration", floor: 2 },
    mis: { name: "Management Information System (MIS)", place: "administration", floor: 2 },
    "cas-sc": { name: "CAS-SC Office", place: "hometel", floor: 2, keywords: ["student council", "cas"] },
    // Added 2026-11-27 at the team's request. Floors aren't in the blueprint records yet.
    usc: { short: "USC Office", name: "University Student Council (USC) Office", place: "hometel", floor: 2, keywords: ["usc", "student council", "activity design", "endorsement"], services: ["activity"] },
    osa: { short: "OSA", name: "Office of Student Affairs (OSA)", place: "hometel", floor: 2, keywords: ["osa", "student affairs", "activity design", "organizations", "permit"], services: ["activity"] },
    // Student’s Center offices read from the Hometel blueprint (blueprints/hometel.png).
    clinic: { name: "University Clinic", place: "hometel", floor: 1, keywords: ["clinic", "health", "nurse", "medical"] },
    guidance: { name: "University Guidance Center", place: "hometel", floor: 1, keywords: ["guidance", "counseling", "counselling"] },
    cafeteria: { name: "WVSU Cafeteria", place: "hometel", floor: 1, keywords: ["cafeteria", "canteen", "food"] },
    testing: { name: "University Testing Center", place: "hometel", floor: 2, keywords: ["testing", "exam", "entrance exam"] },
    forum: { name: "Forum Dimensions", place: "hometel", floor: 2, keywords: ["forum", "publication", "student publication"] },
    faculty: { name: "WVSU Faculty Association Office", place: "hometel", floor: 2, keywords: ["faculty association"] },
    "hometel-office": { name: "Hometel Office", place: "hometel", floor: 2, keywords: ["hometel"] },
    urgp: { name: "University Resource Generation Program & Auxiliary Service", place: "hometel", floor: 2, keywords: ["urgp", "auxiliary", "resource generation"] },
    sports: { name: "University Sports Office", place: "hometel", floor: 3, keywords: ["sports", "athletics"] },
    pescar: { name: "PESCAR Sports & Wellness Club", place: "hometel", floor: 3, keywords: ["pescar", "sports club", "wellness"] },
    fitness: { name: "Fitness & Wellness Center", place: "hometel", floor: 3, keywords: ["gym", "fitness", "wellness"] },
    "cict-dean": { name: "CICT Dean’s Office", place: "cict-building", floor: 2, keywords: ["dean", "cict", "endorsement"] },
    // More Administration offices, read from its Floor 1 and Floor 2 plans.
    records: { name: "Record’s Office", place: "administration", floor: 1, keywords: ["records", "record"] },
    disbursement: { name: "Disbursement", place: "administration", floor: 1, keywords: ["disbursement", "cheque", "check release"] },
    "admin-division": { name: "Admin Division", place: "administration", floor: 1, keywords: ["administrative", "hr", "personnel"] },
    vpaf: { name: "Office of the VP of Administration & Finance", place: "administration", floor: 1, keywords: ["vpaf", "vice president"] },
    vpaa: { name: "Office of the Vice President for Academics", place: "administration", floor: 2, keywords: ["vpaa", "vice president", "academic affairs"] },
    legal: { name: "University Legal Office", place: "administration", floor: 2, keywords: ["legal", "lawyer"] },
    audit: { name: "Internal Audit Service", place: "administration", floor: 2, keywords: ["audit"] },
    "board-secretary": { name: "Office of the Board Secretary", place: "administration", floor: 2, keywords: ["board of regents", "bor"] },
    pamco: { name: "Public Affairs and Marketing Communications Office", place: "administration", floor: 2, keywords: ["public affairs", "marketing", "communications"] },
    illo: { name: "Internal and Local Linkage Office (ILLO)", place: "administration", floor: 2, keywords: ["linkage", "illo"] },
    updo: { name: "University Planning and Development Office", place: "administration", floor: 2, keywords: ["planning", "development"] },
    security: { name: "Security Office", place: "administration", floor: 2, keywords: ["security", "lost and found", "guard"] },
    // Read from the CBM and Roxas Hall plans; names confirmed by the team.
    "cbm-sc": { name: "CBM Student Council (CBM SC)", place: "cbm", floor: 2, keywords: ["cbm sc", "student council", "cbm"] },
    innovator: { name: "The Innovator (CBM publication office)", place: "cbm", floor: 2, keywords: ["innovator", "publication", "cbm"] },
    "com-registrar": { name: "College of Medicine Registrar", place: "com-roxas", floor: 1, keywords: ["medicine registrar", "com registrar", "college of medicine"],
      note: "Separate from the university Registrar in the Administration Building." },
  },
  // Office → its room on the floor plan (site/floors.js keys), checked against the blueprint images.
  officeRooms: { registrar: "Registrar", admission: "Admission Office", payments: "Payments", finance: "Finance Division", president: "Office of the President",
    mis: "Management Information System (MIS)", records: "Record's Office", disbursement: "Disbursement", "admin-division": "Admin Division", vpaf: "Office of the VP of Administration & Finance",
    vpaa: "Office of the Vice President for Academics", legal: "University Legal Office", audit: "Internal Audit Service", "board-secretary": "Office of the Board Secretary",
    pamco: "Public Affairs and Marketing Communications Office", illo: "Internal and Local Linkage Office (ILLO)", updo: "University Planning and Development Office", security: "Security Office",
    "cas-sc": "CAS-SC Office", usc: "University Student Council", osa: "Office of the Student Affairs", clinic: "University Clinic", guidance: "University Guidance Center",
    cafeteria: "WVSU Cafeteria", testing: "University Testing Center", forum: "Forum Dimensions", faculty: "WVSU Faculty Association Office", "hometel-office": "Hometel Office",
    urgp: "Director - University Resource Generation Program & Auxiliary Service", sports: "University Sports Office", pescar: "PESCAR Sports & Wellness Club", fitness: "Fitness & Wellness Center",
    "cict-dean": "Dean Office", "cbm-sc": "CBM SC", innovator: "The Innovator", "com-registrar": "Office of the Registrar" },
  // Named starting places. CICT Building's point is the sketch's start dot outside CICT (agrees with the
  // entrance estimate 10.713289, 122.561433 to within ~1 map unit).
  // Official WVSU pages (opened in a new tab).
  links: {
    ticketon: "https://wvsu.edu.ph/ticketon/",
    charter: "https://wvsu.edu.ph/files/pdf/citizens-charter.pdf",
    orgchart: "https://wvsu.edu.ph/files/pdf/downloads/WVSU-Orgchart.pdf",
  },
  // Processes. Steps as given by the team; fees and processing times stay in the official requirements.
  processes: {
    transcript: {
      title: "Request a Transcript of Records", short: "transcript", office: "registrar", keywords: ["transcript", "tor", "records"],
      order: [["Online", "ticket"], ["Registrar", "door"], ["Cashier", "pay"], ["Registrar", "door"]],
      steps: [
        { title: "Request an appointment", place: null, body: "In WVSU Ticketon, go to Registrar → Appointment and enter:", fields: ["Your registered name", "Degree program", "Document requested", "Number of copies"], action: "ticketon" },
        { title: "Check your ticket", place: null, body: "Read the Registrar’s reply for your appointment date and the documents to bring." },
        { title: "Visit the Registrar", body: "On your scheduled date, get your Order of Payment.", action: "map", place: "administration", office: "registrar" },
        { title: "Pay and claim", place: null, body: "Pay at the Cashier, then return to the Registrar with your official receipt to claim your transcript." },
      ],
    },
    activity: {
      title: "Get an Activity Design approved", short: "activity design", office: "osa", sample: true,
      keywords: ["activity design", "activity", "event", "proposal", "organization", "permit", "osa", "usc"],
      intro: "For student organizations planning an event. Collect each signature in order: your college first, then the Student’s Center, then Administration.",
      steps: [
        { title: "Write your activity design", body: "Use your organization’s template: objectives, date, venue, participants and budget. Print three copies.", place: null },
        { title: "Get your adviser’s signature", body: "Your organization adviser reviews and signs all copies.", place: "cict-building" },
        { title: "Get the Dean’s endorsement", body: "Submit the signed copies to the CICT Dean’s Office for endorsement.", place: "cict-building", office: "cict-dean" },
        { title: "USC endorsement", body: "Bring the endorsed copies to the USC Office for the council’s endorsement.", place: "hometel", office: "usc" },
        { title: "OSA approval", body: "Submit to the Office of Student Affairs. They check the requirements and approve campus activities.", place: "hometel", office: "osa" },
        { title: "President’s approval (off-campus only)", body: "For off-campus or overnight activities, OSA forwards it to the Office of the President. Wait for the approved copy.", place: "administration", office: "president", optional: true },
      ],
    },
  },
  // (continued) A multi-building process. SAMPLE steps for the prototype: confirm the order and signatories with OSA.
  starts: [
    { id: "cict-building", label: "CICT Building", shape: "CICT Building", pt: [161.5, 300.2] },
    { id: "main-gate", label: "Main Gate", shape: "Entrance (Main Gate)" },
    { id: "hometel", label: "Student’s Center", shape: "Hometel" },
    { id: "library", label: "Library", shape: "Library" },
    { id: "administration", label: "Administration", shape: "Administration" },
  ],
  // Walking routes. Prototype data only: traced from the team's sketch (1500 × 1500 reference image,
  // M 408 755 L 449 703 L 407 669 L 498 576 L 662 865 L 829 768), aligned to the building outlines at
  // 5.15 px per map unit, offset (-423.5, -790.9). Not a surveyed walkway, so no times or distances.
  routes: {
    "cict-building>quezon-hall": {
      from: "cict-building", to: "quezon-hall", fromLabel: "CICT Building", toLabel: "Quezon Hall entrance",
      pts: [[161.5, 300.2], [169.4, 290.1], [161.3, 283.5], [178.9, 265.4], [210.8, 321.5], [243.2, 302.7]],
      toShort: "Quezon Hall", room: "QH 1", zigzag: true,
    },
    // Four more walks the team traced from the same CICT start (sketches 2–5 in "CICT to COLLEGE OF DENTISTRY.zip",
    // same 1500 × 1500 MapTiler frame). Bends fitted to the black line; shared bends reuse the CICT → Quezon Hall values.
    "cict-building>cod": {
      from: "cict-building", to: "cod", fromLabel: "CICT Building", toLabel: "College of Dentistry entrance", toShort: "College of Dentistry", zigzag: true,
      pts: [[161.5, 300.2], [169.4, 290.1], [161.3, 283.5], [178.9, 265.4], [210.8, 321.5], [273.3, 282.8], [321.6, 358.5]],
    },
    "cict-building>coe": {
      from: "cict-building", to: "coe", also: ["nab"], fromLabel: "CICT Building", toLabel: "College of Education entrance", toShort: "College of Education", zigzag: true,
      note: "Ends at the College of Education entrance, beside the New Academic Building.",
      pts: [[161.5, 300.2], [169.4, 290.1], [161.3, 283.5], [178.9, 265.4], [210.8, 321.5], [273.3, 282.8], [285.8, 304.4], [309, 291]],
    },
    "cict-building>hometel": {
      from: "cict-building", to: "hometel", fromLabel: "CICT Building", toLabel: "Student’s Center entrance", toShort: "Student’s Center", zigzag: true,
      pts: [[161.5, 300.2], [169.4, 290.1], [161.3, 283.5], [178.9, 265.4], [223.8, 343], [256.4, 322.4]],
    },
    // Traced by the team on 27 Nov (screenshot of the same MapTiler view, 1.101× the sketch frame, matched on Lopez Jaena Hall and WVSU Gate 1).
    "cict-building>administration": {
      from: "cict-building", to: "administration", fromLabel: "CICT Building", toLabel: "Administration Building entrance", toShort: "Administration Building", zigzag: true,
      pts: [[161.5, 300.2], [169.4, 290.1], [161.3, 283.5], [185.6, 257.3], [207.5, 246]],
    },
    "cict-building>rb1": {
      from: "cict-building", to: "rb1", fromLabel: "CICT Building", toLabel: "Research Building 1 entrance", toShort: "Research Building 1",
      pts: [[161.5, 300.2], [148.4, 318.3], [137.4, 312.8], [102.3, 353.9]],
    },
  },
  labelled: ["Quezon Hall", "CICT Building", "Administration", "Library", "Hometel", "Rizal Hall", "Entrance (Main Gate)"],
};
