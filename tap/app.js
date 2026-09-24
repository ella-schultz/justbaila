const CARD_ID_PATTERN = /^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{12}$/;
const API_BASE_URL = "https://justbaila-inner-circle-api.justbaila-inner-circle.workers.dev";
const cardId = new URLSearchParams(window.location.search).get("id")?.trim().toUpperCase() || "";
let currentUndergroundLevel = null;
let currentTechniqueLab = null;
let currentMemberName = "";
let isInstructor = false;
let selectedInstructorMember = null;
let currentDoorAccess = null;
let doorAttempts = 0;
let logoMemberContext = null;

const LOGO_EASTER_EGG = {
  initial: [null, "DON'T.", "SERIOUSLY."],
  generic: [
    "YOU AGAIN.",
    "THERE ARE OTHER BUTTONS.",
    "WE WERE WONDERING WHEN YOU'D TRY THAT AGAIN.",
    "YOU REALLY LIKE THAT LOGO.",
    "NOTHING HAS CHANGED.",
    "STILL JUST A LOGO.",
    "PLEASE FIND SOMETHING PRODUCTIVE TO DO.",
    "THIS IS BECOMING A HABIT."
  ],
  contextual: [
    { eligible: (member) => member.holdsSignal, messages: ["YOU SHOULD PROBABLY PASS THAT ALONG.", "YOU'RE CARRYING SOMETHING."] },
    { eligible: (member) => member.hasPrivateAssignment, messages: ["DON'T YOU HAVE SOMETHING TO DO?"] },
    { eligible: (member) => member.missionCount === 0, messages: ["YOU'VE DONE A LOT OF CLICKING FOR SOMEONE WITH ZERO COMPLETED MISSIONS."] },
    { eligible: (member) => member.isInstructor, messages: ["YOU'RE SUPPOSED TO BE SETTING AN EXAMPLE."] },
    { eligible: (member) => member.established, messages: ["YOU'VE BEEN HERE LONG ENOUGH TO KNOW BETTER."] }
  ],
  personalized: ["YOU FOUND THIS BEFORE WE WERE READY.", "CONNECTION TERMINATED"],
  rareInterruptions: [
    { code: "pattern", openingDelay: 1100, beats: ["YOU ALWAYS CHECK TWICE.", "INTERESTING.", "NOTED."] },
    { code: "wrong-place", beats: ["WRONG PLACE", "YOU'RE NOT SUPPOSED TO BE HERE.", "...", "ACTUALLY, NEVER MIND."] },
    { code: "nothing", openingDelay: 1300, beats: ["WHAT?", "YOU CLICKED US."] },
    { code: "record", beats: ["THIS INTERACTION HAS BEEN RECORDED.", "RECORD ID: {RECORD_ID}", "IT HAS NO PURPOSE."] }
  ],
  runaway: { start: "FINE.", end: "THIS IS EMBARRASSING FOR BOTH OF US.", moves: 3 }
};

const logoEasterEggState = { taps: 0, postTaps: 0, runawayMoves: 0, busy: false, timers: [], sequenceToken: 0, pendingTiltTimer: null };

const states = {
  loading: document.querySelector("#loading-state"),
  invalid: document.querySelector("#invalid-state"),
  error: document.querySelector("#error-state"),
  claim: document.querySelector("#claim-state"),
  passport: document.querySelector("#passport-state")
};

const accessLabel = document.querySelector("#access-label");
const accessSeal = document.querySelector("#access-seal");
const gatedContent = document.querySelectorAll(".gated-content");
const claimForm = document.querySelector("#claim-form");
const claimMessage = document.querySelector("#claim-message");
const retryButton = document.querySelector("#retry-button");
const eventCheckinForm = document.querySelector("#event-checkin-form");
const eventCheckinSection = document.querySelector(".event-checkin");
const signalsSection = document.querySelector(".signals-section");
const milestoneClaimForm = document.querySelector("#milestone-claim-form");
const techniqueLabSection = document.querySelector("#technique-lab");
const techniqueDiscovery = document.querySelector("#technique-discovery");
const techniqueInterface = document.querySelector("#technique-interface");
const instructorCheckForm = document.querySelector("#instructor-check-form");
const doorRoom = document.querySelector("#door-room");
const innerCircleEntry = document.querySelector("#inner-circle-entry");
const undergroundDoor = document.querySelector("#underground-door");
const nominationForm = document.querySelector("#nomination-form");
const membershipInvitationForm = document.querySelector("#membership-invitation-form");
const undergroundLogo = document.querySelector("#underground-logo-trigger");

claimForm.addEventListener("submit", claimPassport);
retryButton.addEventListener("click", loadPassport);
eventCheckinForm.addEventListener("submit", checkInEvent);
milestoneClaimForm.addEventListener("submit", claimMilestone);
document.querySelector("#passport-monogram").addEventListener("click", openTechniqueLab);
document.querySelector("#technique-return").addEventListener("click", closeTechniqueLab);
document.querySelector("#technique-enter").addEventListener("click", revealTechniqueInterface);
document.querySelector("#instructor-member").addEventListener("change", loadInstructorMember);
document.querySelector("#instructor-competency").addEventListener("change", updateInstructorGuidance);
instructorCheckForm.elements.result.forEach((input) => input.addEventListener("change", updateInstructorFeedbackVisibility));
instructorCheckForm.addEventListener("submit", submitInstructorCheck);
document.querySelector("#door-return").addEventListener("click", closeDoorRoom);
undergroundDoor.addEventListener("click", tryDoor);
nominationForm.addEventListener("submit", submitMembershipNomination);
membershipInvitationForm.addEventListener("submit", submitMembershipInvitation);
undergroundLogo.addEventListener("click", handleLogoInteraction);
document.querySelector("#interruption-return").addEventListener("click", closeLogoInterruption);
window.addEventListener("pagehide", resetLogoEffects);
window.addEventListener("hashchange", resetLogoEffects);
window.addEventListener("hashchange", handleDoorRoute);
loadPassport();

async function loadPassport() {
  if (!CARD_ID_PATTERN.test(cardId)) {
    showState("invalid", "Card not recognized");
    return;
  }

  showState("loading", "Following the signal");
  try {
    const response = await fetch(`${API_BASE_URL}/api/card/lookup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cardId })
    });
    const result = await response.json();

    if (result.status === "unclaimed") {
      showState("claim", "Access detected");
      return;
    }
    if (result.status === "claimed" && result.passport) {
      renderPassport(result.passport);
      return;
    }
    if (response.status === 400 || response.status === 404 || result.status === "invalid") {
      showState("invalid", "Card not recognized");
      return;
    }
    throw new Error(result.error || "The service is temporarily unavailable.");
  } catch (error) {
    document.querySelector("#error-message").textContent = error.message;
    showState("error", "Signal lost");
  }
}

async function claimPassport(event) {
  event.preventDefault();
  claimMessage.textContent = "";
  const submitButton = claimForm.querySelector("button[type='submit']");
  const memberName = new FormData(claimForm).get("memberName")?.toString().trim() || "";
  submitButton.disabled = true;
  submitButton.textContent = "Opening access…";

  try {
    const response = await fetch(`${API_BASE_URL}/api/card/claim`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cardId, memberName })
    });
    const result = await response.json();
    if ((response.ok || response.status === 409) && result.status === "claimed" && result.passport) {
      renderPassport(result.passport);
      return;
    }
    if (response.status === 404 || result.status === "invalid") {
      showState("invalid", "Card not recognized");
      return;
    }
    claimMessage.textContent = result.error || "We couldn’t grant access. Please try again.";
  } catch {
    claimMessage.textContent = "The service is temporarily unavailable. Please try again.";
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "Enter the Underground";
  }
}

async function checkInEvent(event) {
  event.preventDefault();
  const button = eventCheckinForm.querySelector("button[type='submit']");
  const message = document.querySelector("#event-checkin-message");
  const checkInCode = new FormData(eventCheckinForm).get("checkInCode")?.toString() || "";
  button.disabled = true;
  button.textContent = "Checking in…";
  message.textContent = "";
  try {
    const response = await fetch(`${API_BASE_URL}/api/events/check-in`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cardId, checkInCode })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "We couldn’t check you in.");
    eventCheckinForm.reset();
    renderPassport(result.passport);
    message.textContent = `Checked in: ${result.eventTitle}`;
  } catch (error) {
    message.textContent = error.message;
  } finally {
    button.disabled = false;
    button.textContent = "Check in";
  }
}

async function claimMilestone(event) {
  event.preventDefault();
  const button = milestoneClaimForm.querySelector("button[type='submit']");
  const message = document.querySelector("#milestone-claim-message");
  const claimCode = new FormData(milestoneClaimForm).get("claimCode")?.toString() || "";
  button.disabled = true;
  button.textContent = "Claiming…";
  message.textContent = "";
  try {
    const response = await fetch(`${API_BASE_URL}/api/milestones/claim`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cardId, claimCode })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "We couldn’t claim this milestone.");
    milestoneClaimForm.reset();
    renderPassport(result.passport);
    message.textContent = `Milestone achieved: ${result.milestoneTitle}`;
  } catch (error) {
    message.textContent = error.message;
  } finally {
    button.disabled = false;
    button.textContent = "Claim milestone";
  }
}

function renderPassport(passport) {
  const previousLevel = currentUndergroundLevel;
  currentUndergroundLevel = passport.undergroundLevel;
  document.querySelector("#passport-name").textContent = passport.memberName;
  currentMemberName = passport.memberName;
  currentDoorAccess = passport.doorAccess || { state: "locked" };
  isInstructor = Boolean(passport.isInstructor);
  document.querySelector("#member-role").hidden = !isInstructor;
  document.querySelector("#passport-state").classList.toggle("has-instructor-role", isInstructor);
  document.querySelector("#instructor-console").hidden = !isInstructor;
  techniqueInterface.classList.toggle("instructor-mode", isInstructor);
  document.querySelector("#underground-level").textContent = passport.undergroundLevel;
  document.querySelector("#passport-card-number").textContent = passport.cardNumber;
  document.querySelector("#passport-activation-date").textContent = formatDate(passport.activationDate);
  document.querySelector("#passport-monogram").textContent = getInitials(passport.memberName);
  document.querySelector("#attendance-count").textContent = passport.attendanceCount;
  document.querySelector("#milestone-count").textContent = passport.milestoneCount;
  document.querySelector("#mission-count").textContent = passport.missionCount;
  document.querySelector("#key-count").textContent = passport.keyBalance;
  document.querySelector("#member-relay-code").textContent = passport.relayCode || "------";
  currentTechniqueLab = passport.techniqueLab || { checksAvailable: false, competencies: [] };
  const privateAssignment = (passport.missions || []).find((mission) => mission.privateAssignment && mission.assignmentStatus === "active" && !mission.completed);
  logoMemberContext = {
    memberName: passport.memberName,
    cardNumber: passport.cardNumber,
    missionCount: Number(passport.missionCount || 0),
    isInstructor: Boolean(passport.isInstructor),
    holdsSignal: (passport.signals || []).length > 0,
    hasPrivateAssignment: Boolean(privateAssignment),
    established: isEstablishedMember(passport.activationDate)
  };
  renderSignals(passport.signals || []);
  renderInvitation(passport.invitation);
  renderRewards(passport.rewards || [], passport.keyBalance);
  renderMilestones(passport.milestones || []);
  renderMissions(passport.missions || []);
  renderTechniqueLab(currentTechniqueLab);
  showState("passport", "Access granted");
  renderMembershipAccess(passport.membershipAccess || {});
  accessSeal.hidden = !privateAssignment;
  accessSeal.href = "#private-assignment";
  accessSeal.classList.toggle("has-private-assignment", Boolean(privateAssignment));
  accessLabel.textContent = "Private assignment";
  eventCheckinSection.hidden = !passport.socialCheckinVisible;
  signalsSection.hidden = !(passport.signalsVisible && (passport.signals || []).length > 0);
  if (previousLevel && previousLevel !== passport.undergroundLevel) showLevelUpdate(previousLevel, passport.undergroundLevel);
  else showKeyAward(passport.latestKeyTransaction);
  handleDoorRoute();
}

function handleLogoInteraction() {
  if (!logoMemberContext || logoEasterEggState.busy) return;
  if (logoEasterEggState.runawayMoves > 0) {
    moveRunawayLogo();
    return;
  }
  const discoveryVersion = logoMemberContext.cardNumber === "001" ? "v4" : "v2";
  const discoveryKey = `justbaila-logo-discovered:${discoveryVersion}:${cardId}`;
  let discovered = false;
  try { discovered = localStorage.getItem(discoveryKey) === "yes"; } catch {}
  if (!discovered) {
    logoEasterEggState.taps += 1;
    if (logoEasterEggState.taps === 1) {
      logoEasterEggState.pendingTiltTimer = scheduleLogoTask(() => {
        undergroundLogo.classList.add(reducedMotion() ? "logo-discovery-marked" : "logo-discovery-tilted");
        logoEasterEggState.pendingTiltTimer = null;
      }, 620);
      return;
    }
    if (logoEasterEggState.pendingTiltTimer) {
      clearTimeout(logoEasterEggState.pendingTiltTimer);
      logoEasterEggState.pendingTiltTimer = null;
    }
    undergroundLogo.classList.remove("logo-discovery-tilted", "logo-discovery-marked", "logo-discovery-shifted");
    if (logoEasterEggState.taps === 2) {
      showLogoWhisper(LOGO_EASTER_EGG.initial[1], 1900);
      return;
    }
    if (logoEasterEggState.taps === 3) {
      undergroundLogo.classList.add(reducedMotion() ? "logo-discovery-marked" : "logo-discovery-shifted");
      showLogoWhisper(LOGO_EASTER_EGG.initial[2], 1900);
      return;
    }
    undergroundLogo.classList.remove("logo-discovery-shifted", "logo-discovery-marked");
    try { localStorage.setItem(discoveryKey, "yes"); } catch {}
    runCardRecognitionSequence();
    return;
  }

  logoEasterEggState.postTaps += 1;
  undergroundLogo.classList.remove("logo-flicker");
  void undergroundLogo.offsetWidth;
  undergroundLogo.classList.add("logo-flicker");
  if (logoEasterEggState.postTaps === 1) {
    showLogoWhisper("YOU AGAIN.");
    return;
  }
  const chance = secureRandom();
  if (logoEasterEggState.postTaps >= 6 && chance < 0.012 && logoMemberContext.memberName) runPersonalizedSequence();
  else if (logoEasterEggState.postTaps >= 6 && chance < 0.035) runRareInterruption();
  else if (logoEasterEggState.postTaps >= 8 && chance < 0.07) startRunawayLogo();
  else if (chance < 0.2) showLogoWhisper(pickLogoResponse());
}

function pickLogoResponse() {
  const eligible = LOGO_EASTER_EGG.contextual.filter((response) => response.eligible(logoMemberContext)).flatMap((response) => response.messages);
  const pool = eligible.length && secureRandom() < 0.55 ? eligible : LOGO_EASTER_EGG.generic;
  return pool[Math.floor(secureRandom() * pool.length)];
}

function showLogoWhisper(message, duration = 2600) {
  const whisper = document.querySelector("#logo-whisper");
  whisper.textContent = message;
  whisper.classList.add("is-visible");
  scheduleLogoTask(() => whisper.classList.remove("is-visible"), duration);
  scheduleLogoTask(() => { if (!whisper.classList.contains("is-visible")) whisper.textContent = ""; }, duration + 250);
}

async function runCardRecognitionSequence() {
  const token = beginLogoInterruption();
  await setInterruptionBeat("WE KNOW WHICH CARD THIS IS.", "", 1800, token);
  await setInterruptionBeat("WE KNOW WHICH CARD THIS IS.", `CARD ${logoMemberContext.cardNumber}`, 2100, token);
  showFinalInterruptionBeat("GO BACK.", "", token);
}

async function runPersonalizedSequence() {
  const token = beginLogoInterruption();
  await setInterruptionBeat(`HELLO, ${logoMemberContext.memberName.toUpperCase()}.`, "", 1900, token);
  await setInterruptionBeat(LOGO_EASTER_EGG.personalized[0], "", 2200, token);
  showFinalInterruptionBeat(LOGO_EASTER_EGG.personalized[1], "", token);
}

async function runRareInterruption() {
  const sequence = LOGO_EASTER_EGG.rareInterruptions[Math.floor(secureRandom() * LOGO_EASTER_EGG.rareInterruptions.length)];
  const token = beginLogoInterruption();
  if (sequence.openingDelay) await waitForInterruption(sequence.openingDelay, token);
  const recordId = makeDecorativeRecordId();
  for (let index = 0; index < sequence.beats.length - 1; index += 1) {
    const message = sequence.beats[index].replace("{RECORD_ID}", recordId);
    await setInterruptionBeat(message, "", message === "..." ? 1250 : 1750, token);
  }
  const finalMessage = sequence.beats.at(-1).replace("{RECORD_ID}", recordId);
  showFinalInterruptionBeat(finalMessage, "", token);
}

function waitForInterruption(duration, token) {
  if (token !== logoEasterEggState.sequenceToken) return Promise.resolve();
  document.querySelector("#interruption-message").textContent = "";
  document.querySelector("#interruption-detail").textContent = "";
  return new Promise((resolve) => scheduleLogoTask(resolve, reducedMotion() ? Math.min(duration, 650) : duration));
}

function makeDecorativeRecordId() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const part = (length) => Array.from({ length }, () => alphabet[Math.floor(secureRandom() * alphabet.length)]).join("");
  return `${part(2)}-${part(3)}`;
}

function beginLogoInterruption() {
  resetLogoEffects(false);
  logoEasterEggState.busy = true;
  logoEasterEggState.sequenceToken += 1;
  const overlay = document.querySelector("#underground-interruption");
  overlay.hidden = false;
  requestAnimationFrame(() => overlay.classList.add("is-visible"));
  return logoEasterEggState.sequenceToken;
}

function setInterruptionBeat(message, detail, duration, token, showReturn = false) {
  if (token !== logoEasterEggState.sequenceToken) return Promise.resolve();
  document.querySelector("#interruption-message").textContent = message;
  document.querySelector("#interruption-detail").textContent = detail;
  const returnButton = document.querySelector("#interruption-return");
  returnButton.hidden = !showReturn;
  if (showReturn) returnButton.focus({ preventScroll: true });
  return new Promise((resolve) => scheduleLogoTask(resolve, reducedMotion() ? Math.min(duration, 650) : duration));
}

function showFinalInterruptionBeat(message, detail, token) {
  if (token !== logoEasterEggState.sequenceToken) return;
  document.querySelector("#interruption-message").textContent = message;
  document.querySelector("#interruption-detail").textContent = detail;
  const returnButton = document.querySelector("#interruption-return");
  returnButton.hidden = false;
  returnButton.focus({ preventScroll: true });
}

function closeLogoInterruption() {
  logoEasterEggState.sequenceToken += 1;
  logoEasterEggState.busy = false;
  const overlay = document.querySelector("#underground-interruption");
  overlay.classList.remove("is-visible");
  document.querySelector("#interruption-return").hidden = true;
  scheduleLogoTask(() => { overlay.hidden = true; }, reducedMotion() ? 0 : 260);
  undergroundLogo.focus({ preventScroll: true });
}

function startRunawayLogo() {
  showLogoWhisper(LOGO_EASTER_EGG.runaway.start, 900);
  if (reducedMotion()) {
    scheduleLogoTask(() => showLogoWhisper(LOGO_EASTER_EGG.runaway.end, 1900), 950);
    return;
  }
  logoEasterEggState.runawayMoves = LOGO_EASTER_EGG.runaway.moves;
  undergroundLogo.classList.add("logo-runaway");
}

function moveRunawayLogo() {
  const offsets = [[12, -6], [-10, 7], [8, 9], [-7, -8]];
  const [x, y] = offsets[(LOGO_EASTER_EGG.runaway.moves - logoEasterEggState.runawayMoves) % offsets.length];
  undergroundLogo.style.transform = `translate(${x}px, ${y}px)`;
  logoEasterEggState.runawayMoves -= 1;
  if (logoEasterEggState.runawayMoves === 0) scheduleLogoTask(() => {
    undergroundLogo.style.transform = "";
    undergroundLogo.classList.remove("logo-runaway");
    showLogoWhisper(LOGO_EASTER_EGG.runaway.end, 2200);
  }, 300);
}

function resetLogoEffects(invalidateSequence = true) {
  logoEasterEggState.timers.forEach(clearTimeout);
  logoEasterEggState.timers = [];
  logoEasterEggState.busy = false;
  logoEasterEggState.runawayMoves = 0;
  logoEasterEggState.pendingTiltTimer = null;
  undergroundLogo.style.transform = "";
  undergroundLogo.classList.remove("logo-flicker", "logo-runaway", "logo-discovery-tilted", "logo-discovery-shifted", "logo-discovery-marked");
  const whisper = document.querySelector("#logo-whisper");
  whisper.classList.remove("is-visible");
  whisper.textContent = "";
  const overlay = document.querySelector("#underground-interruption");
  overlay.classList.remove("is-visible");
  overlay.hidden = true;
  document.querySelector("#interruption-return").hidden = true;
  if (invalidateSequence) logoEasterEggState.sequenceToken += 1;
}

function scheduleLogoTask(callback, delay) {
  const timer = window.setTimeout(callback, delay);
  logoEasterEggState.timers.push(timer);
  return timer;
}

function secureRandom() {
  if (!globalThis.crypto?.getRandomValues) return Math.random();
  const value = new Uint32Array(1);
  crypto.getRandomValues(value);
  return value[0] / 4294967296;
}

function reducedMotion() { return window.matchMedia("(prefers-reduced-motion: reduce)").matches; }

function isEstablishedMember(activationDate) {
  if (!activationDate) return false;
  const date = new Date(activationDate.includes("T") ? activationDate : `${activationDate.replace(" ", "T")}Z`);
  return Number.isFinite(date.getTime()) && Date.now() - date.getTime() >= 90 * 24 * 60 * 60 * 1000;
}

function renderMembershipAccess(access) {
  const section = document.querySelector("#membership-expansion");
  const nomination = document.querySelector("#nomination-action");
  const invitation = document.querySelector("#membership-invitation-action");
  nomination.hidden = !access.canNominate;
  invitation.hidden = !access.canInvite;
  section.hidden = !(access.canNominate || access.canInvite);
  const unlocks = [];
  try {
    if (access.canNominate && !localStorage.getItem(`justbaila-membership-nomination:v1:${cardId}`)) {
      localStorage.setItem(`justbaila-membership-nomination:v1:${cardId}`, "seen");
      unlocks.push("NEW ACCESS GRANTED // PASS IT ON");
    }
    if (access.canInvite && !localStorage.getItem(`justbaila-membership-invitation:v1:${cardId}`)) {
      localStorage.setItem(`justbaila-membership-invitation:v1:${cardId}`, "seen");
      unlocks.push("ACCESS EXPANDED // OPEN THE DOOR");
    }
  } catch {}
  if (unlocks.length) window.setTimeout(() => showAccessReveal(unlocks.at(-1)), 250);
}

function showAccessReveal(message) {
  const award = document.querySelector("#key-award");
  award.textContent = message;
  award.hidden = false;
  window.setTimeout(() => award.classList.add("is-visible"), 50);
  window.setTimeout(() => {
    award.classList.remove("is-visible");
    window.setTimeout(() => { award.hidden = true; }, 500);
  }, 5500);
}

async function submitMembershipNomination(event) {
  event.preventDefault();
  const data = new FormData(nominationForm);
  const button = nominationForm.querySelector("button");
  const message = document.querySelector("#nomination-message");
  button.disabled = true;
  message.textContent = "Sending signal…";
  try {
    const response = await fetch(`${API_BASE_URL}/api/membership/nominate`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cardId, nominee: data.get("nominee"), reason: data.get("reason") }) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "We couldn't send that nomination.");
    nominationForm.reset();
    message.textContent = "SIGNAL SENT // We'll take it from here.";
  } catch (error) { message.textContent = error.message; }
  finally { button.disabled = false; }
}

async function submitMembershipInvitation(event) {
  event.preventDefault();
  const data = new FormData(membershipInvitationForm);
  const button = membershipInvitationForm.querySelector("button");
  const message = document.querySelector("#membership-invitation-message");
  button.disabled = true;
  message.textContent = "Recording invitation…";
  try {
    const response = await fetch(`${API_BASE_URL}/api/membership/invite`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cardId, invitee: data.get("invitee"), note: data.get("note") }) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "We couldn't record that invitation.");
    membershipInvitationForm.reset();
    message.textContent = "INVITATION RECORDED // We'll prepare the access card.";
  } catch (error) { message.textContent = error.message; }
  finally { button.disabled = false; }
}

function showDoorRoom() {
  if (!currentDoorAccess) return;
  doorAttempts = 0;
  document.querySelector("#door-response").textContent = "";
  undergroundDoor.classList.remove("door-denied");
  document.body.classList.add("door-room-open");
  doorRoom.hidden = false;
  doorRoom.scrollIntoView({ block: "start" });
  document.querySelector("#door-return").focus({ preventScroll: true });
}

function closeDoorRoom() {
  document.body.classList.remove("door-room-open");
  doorRoom.hidden = true;
  doorAttempts = 0;
  if (window.location.hash === "#the-door") window.history.pushState(null, "", `${window.location.pathname}${window.location.search}`);
  innerCircleEntry.focus({ preventScroll: true });
}

function handleDoorRoute() {
  if (window.location.hash === "#the-door" && currentDoorAccess) showDoorRoom();
  else if (!doorRoom.hidden) closeDoorRoom();
}

function tryDoor() {
  if (currentDoorAccess?.state !== "locked") return;
  doorAttempts += 1;
  const responses = ["ACCESS DENIED", "ACCESS DENIED", "STILL LOCKED.", "YES, WE NOTICED."];
  document.querySelector("#door-response").textContent = responses[doorAttempts - 1] || "NO.";
  undergroundDoor.classList.remove("door-denied");
  void undergroundDoor.offsetWidth;
  undergroundDoor.classList.add("door-denied");
}

function showLevelUpdate(previousLevel, nextLevel) {
  const award = document.querySelector("#key-award");
  award.textContent = `LEVEL UPDATED // ${previousLevel} → ${nextLevel}`;
  award.hidden = false;
  window.setTimeout(() => award.classList.add("is-visible"), 50);
  window.setTimeout(() => {
    award.classList.remove("is-visible");
    window.setTimeout(() => { award.hidden = true; }, 500);
  }, 5000);
}

function openTechniqueLab() {
  const discoveryKey = `justbaila-technique-lab-discovered:v1:${cardId}`;
  let discovered = false;
  try { discovered = window.localStorage.getItem(discoveryKey) === "yes"; } catch {}
  document.body.classList.add("technique-lab-open");
  techniqueLabSection.hidden = false;
  techniqueDiscovery.hidden = discovered;
  techniqueInterface.hidden = !discovered;
  techniqueLabSection.scrollIntoView({ behavior: "smooth", block: "start" });
  if (isInstructor) loadInstructorConsole();
}

function revealTechniqueInterface() {
  try { window.localStorage.setItem(`justbaila-technique-lab-discovered:v1:${cardId}`, "yes"); } catch {}
  techniqueDiscovery.hidden = true;
  techniqueInterface.hidden = false;
  document.querySelector("#technique-lab-title").focus?.();
}

function closeTechniqueLab() {
  document.body.classList.remove("technique-lab-open");
  techniqueLabSection.hidden = true;
  document.querySelector("#passport-state").scrollIntoView({ behavior: "smooth", block: "center" });
  document.querySelector("#passport-monogram").focus();
}

function renderTechniqueLab(techniqueLab) {
  const availability = document.querySelector("#technique-availability");
  availability.hidden = !techniqueLab.checksAvailable;
  const availabilityWindow = document.querySelector("#technique-window");
  availabilityWindow.hidden = !techniqueLab.availabilityWindow;
  availabilityWindow.textContent = techniqueLab.availabilityWindow ? `Next instructor availability: ${techniqueLab.availabilityWindow}` : "";
  const grid = document.querySelector("#technique-grid");
  grid.replaceChildren(...techniqueLab.competencies.map((competency) => {
    const article = document.createElement("article");
    article.className = `technique-card technique-${competency.state.replace("_", "-")}`;
    const heading = document.createElement("div");
    heading.className = "technique-card-heading";
    const title = document.createElement("h3");
    title.textContent = competency.name;
    const state = document.createElement("span");
    state.textContent = competency.state === "verified" ? "Verified" : competency.state === "working" ? "In progress" : "Not yet verified";
    heading.append(title, state);
    const description = document.createElement("p");
    description.textContent = competency.description;
    article.append(heading, description);

    if (competency.latestResult === "keep_working") {
      const feedback = document.createElement("div");
      feedback.className = "technique-feedback";
      const label = document.createElement("strong");
      label.textContent = "Keep working";
      const guidance = document.createElement("p");
      guidance.textContent = competency.instructorNote || competency.feedbackTags.join(" · ") || "This is guidance, not failure. You can ask for feedback again whenever you’re ready.";
      feedback.append(label, guidance);
      article.append(feedback);
    }

    if (techniqueLab.checksAvailable) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "technique-request";
      button.textContent = competency.requestActive ? "Feedback requested" : competency.state === "verified" ? "Get more feedback" : "Get feedback";
      button.disabled = competency.requestActive;
      button.addEventListener("click", () => requestTechniqueCheck(competency, button));
      article.append(button);
    }
    return article;
  }));
}

async function requestTechniqueCheck(competency, button) {
  const message = document.querySelector("#technique-message");
  button.disabled = true;
  button.textContent = "Requesting…";
  message.textContent = "";
  try {
    const response = await fetch(`${API_BASE_URL}/api/technique/request`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cardId, competencyCode: competency.code })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "We couldn’t save that request.");
    currentTechniqueLab = result.techniqueLab;
    renderTechniqueLab(currentTechniqueLab);
    message.textContent = "Ask a participating instructor for feedback on this skill when they’re available.";
  } catch (error) {
    message.textContent = error.message;
    button.disabled = false;
    button.textContent = "Get feedback";
  }
}

async function instructorApi(path, payload = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ cardId, ...payload })
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Instructor access is unavailable.");
  return result;
}

async function loadInstructorConsole() {
  const message = document.querySelector("#instructor-check-message");
  try {
    const [membersResult, requestsResult] = await Promise.all([
      instructorApi("/api/instructor/members"),
      instructorApi("/api/instructor/technique/requests")
    ]);
    const memberSelect = document.querySelector("#instructor-member");
    const currentValue = memberSelect.value;
    memberSelect.replaceChildren(new Option("Choose a member", ""), ...membersResult.members.map((member) => new Option(`${member.memberName} · Card ${member.cardNumber}`, member.passportId)));
    if (currentValue) memberSelect.value = currentValue;
    renderInstructorRequests(requestsResult.requests);
    message.textContent = "";
  } catch (error) { message.textContent = error.message; }
}

function renderInstructorRequests(requests) {
  const container = document.querySelector("#instructor-request-list");
  const heading = document.createElement("p");
  heading.className = "instructor-request-heading";
  heading.textContent = requests.length ? `${requests.length} waiting for feedback` : "No active feedback requests";
  container.replaceChildren(heading, ...requests.map((request) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = `${request.memberName} · ${request.competencyName}`;
    button.addEventListener("click", async () => {
      document.querySelector("#instructor-member").value = String(request.passportId);
      await loadInstructorMember();
      document.querySelector("#instructor-competency").value = request.competencyCode;
      updateInstructorGuidance();
      instructorCheckForm.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    return button;
  }));
}

async function loadInstructorMember() {
  const passportId = Number(document.querySelector("#instructor-member").value);
  const competencySelect = document.querySelector("#instructor-competency");
  if (!passportId) {
    selectedInstructorMember = null;
    competencySelect.replaceChildren(new Option("Choose a member first", ""));
    competencySelect.disabled = true;
    updateInstructorGuidance();
    return;
  }
  try {
    selectedInstructorMember = await instructorApi("/api/instructor/technique/member", { passportId });
    competencySelect.replaceChildren(new Option("Choose a competency", ""), ...selectedInstructorMember.techniqueLab.competencies.map((competency) => new Option(`${competency.name} · ${formatTechniqueMemberState(competency.state)}`, competency.code)));
    competencySelect.disabled = false;
    updateInstructorGuidance();
  } catch (error) {
    document.querySelector("#instructor-check-message").textContent = error.message;
  }
}

function updateInstructorGuidance() {
  const code = document.querySelector("#instructor-competency").value;
  const competency = selectedInstructorMember?.techniqueLab.competencies.find((item) => item.code === code);
  const guidance = document.querySelector("#instructor-guidance");
  guidance.hidden = !competency;
  document.querySelector("#instructor-guidance-copy").textContent = competency?.instructorCriteria || "";
  const tags = document.querySelector("#instructor-feedback-tags");
  tags.replaceChildren(...(competency?.feedbackOptions || []).map((option) => {
    const label = document.createElement("label");
    const input = document.createElement("input");
    input.type = "checkbox";
    input.name = "feedbackTags";
    input.value = option;
    label.append(input, option);
    return label;
  }));
  updateInstructorFeedbackVisibility();
}

function updateInstructorFeedbackVisibility() {
  const keepWorking = instructorCheckForm.elements.result.value === "keep_working";
  const options = document.querySelector("#instructor-feedback-options");
  options.hidden = !keepWorking;
  if (!keepWorking) options.querySelectorAll("input").forEach((input) => { input.checked = false; });
}

async function submitInstructorCheck(event) {
  event.preventDefault();
  const data = new FormData(instructorCheckForm);
  const button = instructorCheckForm.querySelector("button[type='submit']");
  const message = document.querySelector("#instructor-check-message");
  button.disabled = true;
  message.textContent = "Recording…";
  try {
    const result = await instructorApi("/api/instructor/technique/check", {
      passportId: Number(data.get("passportId")),
      competencyCode: data.get("competencyCode"),
      result: data.get("result"),
      feedbackTags: data.getAll("feedbackTags"),
      instructorNote: data.get("instructorNote")
    });
    message.textContent = result.milestoneAwarded ? "Feedback recorded. SECOND PASS was unlocked." : "Feedback recorded.";
    instructorCheckForm.elements.result.forEach((input) => { input.checked = false; });
    instructorCheckForm.elements.instructorNote.value = "";
    await loadInstructorMember();
    await loadInstructorConsole();
  } catch (error) { message.textContent = error.message; }
  finally { button.disabled = false; }
}

function formatTechniqueMemberState(state) {
  if (state === "verified") return "Verified";
  if (state === "working") return "In progress";
  return "Not yet verified";
}

function renderSignals(signals) {
  const grid = document.querySelector("#signals-grid");
  grid.replaceChildren(...signals.map((signal) => {
    const article = document.createElement("article");
    article.className = "signal-card";
    article.innerHTML = `<p class="signal-status">Signal received</p><h3></h3><p>It doesn't stay anywhere for long.</p>`;
    article.querySelector("h3").textContent = signal.title;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "member-button signal-relay-start";
    button.textContent = "Relay the Signal";
    const form = document.createElement("form");
    form.className = "signal-relay-form";
    form.hidden = true;
    form.innerHTML = `<label>Recipient's relay code<input name="relayCode" minlength="6" maxlength="6" autocomplete="off" inputmode="text" required /></label><button class="member-button" type="submit">Find member</button><p class="form-message" aria-live="polite"></p>`;
    button.addEventListener("click", () => { button.hidden = true; form.hidden = false; form.querySelector("input").focus(); });
    form.addEventListener("submit", (event) => resolveRecipient(event, signal, article));
    article.append(button, form);
    return article;
  }));
}

async function resolveRecipient(event, signal, article) {
  event.preventDefault();
  const form = event.currentTarget;
  const button = form.querySelector("button");
  const message = form.querySelector(".form-message");
  const relayCode = new FormData(form).get("relayCode")?.toString().trim().toUpperCase() || "";
  button.disabled = true;
  button.textContent = "Checking…";
  message.textContent = "";
  try {
    const response = await fetch(`${API_BASE_URL}/api/signals/recipient`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cardId, signalCode: signal.code, relayCode }) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "That member could not be found.");
    form.hidden = true;
    const confirmation = document.createElement("div");
    confirmation.className = "signal-confirmation";
    const text = document.createElement("p");
    text.textContent = `Relay to ${result.recipient.name}?`;
    const confirm = document.createElement("button");
    confirm.type = "button";
    confirm.className = "member-button";
    confirm.textContent = "Confirm relay";
    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.className = "signal-cancel";
    cancel.textContent = "Not this person";
    confirm.addEventListener("click", () => confirmRelay(signal, relayCode, confirm, confirmation));
    cancel.addEventListener("click", () => { confirmation.remove(); form.hidden = false; button.disabled = false; button.textContent = "Find member"; });
    confirmation.append(text, confirm, cancel);
    article.append(confirmation);
  } catch (error) {
    message.textContent = error.message;
    button.disabled = false;
    button.textContent = "Find member";
  }
}

async function confirmRelay(signal, relayCode, button, container) {
  button.disabled = true;
  button.textContent = "Relaying…";
  try {
    const response = await fetch(`${API_BASE_URL}/api/signals/relay`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cardId, signalCode: signal.code, relayCode, idempotencyKey: crypto.randomUUID().replaceAll("-", "") }) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "The Signal could not be relayed.");
    renderPassport(result.passport);
    showSignalNotice();
  } catch (error) {
    container.querySelector("p").textContent = error.message;
    button.disabled = false;
    button.textContent = "Try again";
  }
}

function showSignalNotice() {
  const award = document.querySelector("#key-award");
  award.textContent = "SIGNAL RELAYED // Someone else is carrying it now.";
  award.hidden = false;
  requestAnimationFrame(() => award.classList.add("is-visible"));
  window.setTimeout(() => { award.classList.remove("is-visible"); window.setTimeout(() => { award.hidden = true; }, 450); }, 4200);
}

function renderRewards(rewards, keyBalance) {
  const grid = document.querySelector("#rewards-grid");
  grid.replaceChildren(...rewards.map((reward) => {
    const article = document.createElement("article");
    const affordable = keyBalance >= reward.keyCost;
    article.className = `reward-card${affordable ? " reward-unlocked" : ""}${reward.pending ? " reward-pending" : ""}`;
    const cost = document.createElement("p");
    cost.className = "reward-cost";
    cost.textContent = `${reward.keyCost} Keys`;
    const title = document.createElement("h3");
    title.textContent = reward.title;
    const description = document.createElement("p");
    description.textContent = reward.description;
    const button = document.createElement("button");
    button.type = "button";
    button.disabled = !affordable || reward.pending;
    button.textContent = reward.pending ? "Redemption pending" : affordable ? "Redeem reward" : `${reward.keyCost - keyBalance} more Keys`;
    const message = document.createElement("p");
    message.className = "form-message";
    if (reward.pending) message.textContent = "Find a JustBaila team member to claim your reward.";
    button.addEventListener("click", () => redeemReward(reward, button, message));
    article.append(cost, title, description, button, message);
    return article;
  }));
}

async function redeemReward(reward, button, message) {
  if (!window.confirm(`Redeem ${reward.keyCost} Keys for “${reward.title}”?`)) return;
  button.disabled = true;
  button.textContent = "Redeeming…";
  message.textContent = "";
  try {
    const response = await fetch(`${API_BASE_URL}/api/rewards/redeem`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cardId, rewardCode: reward.code, idempotencyKey: crypto.randomUUID().replaceAll("-", "") })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "We couldn’t redeem this reward.");
    renderPassport(result.passport);
  } catch (error) {
    message.textContent = error.message;
    button.disabled = false;
    button.textContent = "Redeem reward";
  }
}

function renderInvitation(invitation) {
  if (!invitation) return;
  document.querySelector("#invitation-kicker").textContent = invitation.kicker;
  document.querySelector("#invitation-title").textContent = invitation.title;
  document.querySelector("#invitation-description").textContent = invitation.description;
  const link = document.querySelector("#invitation-link");
  const buttonLabel = invitation.buttonLabel?.trim() || "";
  const buttonUrl = invitation.buttonUrl?.trim() || "";
  link.hidden = !(buttonLabel && buttonUrl);
  if (!link.hidden) {
    link.textContent = buttonLabel;
    link.href = buttonUrl;
  } else {
    link.textContent = "";
    link.removeAttribute("href");
  }
}

function renderMilestones(milestones) {
  const grid = document.querySelector("#milestones-grid");
  grid.replaceChildren(...milestones.map((milestone) => {
    const article = document.createElement("article");
    article.className = `milestone-card${milestone.achieved ? " milestone-achieved" : ""}`;
    const seal = document.createElement("span");
    seal.className = "milestone-seal";
    seal.setAttribute("aria-hidden", "true");
    seal.textContent = milestone.achieved ? "✓" : "◇";
    const status = document.createElement("p");
    status.className = "milestone-status";
    status.textContent = milestone.achieved ? "Achieved" : milestone.claimableByCode ? "Code required" : milestone.memberClaimable ? "Honor claim" : "Locked";
    const title = document.createElement("h3");
    title.textContent = milestone.title;
    const description = document.createElement("p");
    description.className = "milestone-description";
    description.textContent = milestone.description;
    article.append(seal, status, title, description);
    if (milestone.memberClaimable && !milestone.claimableByCode && !milestone.achieved) {
      const button = document.createElement("button");
      button.className = "milestone-claim-button";
      button.type = "button";
      button.textContent = "Claim milestone";
      const message = document.createElement("p");
      message.className = "form-message";
      button.addEventListener("click", () => claimMilestoneDirect(milestone, button, message));
      article.append(button, message);
    }
    return article;
  }));
}

async function claimMilestoneDirect(milestone, button, message) {
  button.disabled = true;
  button.textContent = "Claiming…";
  message.textContent = "";
  try {
    const response = await fetch(`${API_BASE_URL}/api/milestones/claim`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cardId, milestoneCode: milestone.code })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "We couldn’t claim this milestone.");
    renderPassport(result.passport);
  } catch (error) {
    message.textContent = error.message;
    button.disabled = false;
    button.textContent = "Claim milestone";
  }
}

function renderMissions(missions) {
  const grid = document.querySelector("#missions-grid");
  const orderedMissions = [
    ...missions.filter((mission) => mission.privateAssignment),
    ...missions.filter((mission) => !mission.privateAssignment)
  ];
  let privateAnchorAssigned = false;
  let globalMissionNumber = 0;
  grid.replaceChildren(...orderedMissions.map((mission) => {
    const article = document.createElement("article");
    article.className = `mission-card${mission.completed ? " mission-completed" : ""}${mission.privateAssignment ? " mission-private" : ""}`;
    if (mission.privateAssignment && mission.assignmentStatus === "active" && !privateAnchorAssigned) {
      article.id = "private-assignment";
      privateAnchorAssigned = true;
    }

    const meta = document.createElement("div");
    meta.className = "mission-meta";
    const number = document.createElement("span");
    if (!mission.privateAssignment) globalMissionNumber += 1;
    number.textContent = mission.privateAssignment ? "Private assignment" : `Mission ${String(globalMissionNumber).padStart(2, "0")}`;
    const status = document.createElement("span");
    status.className = "mission-status";
    status.textContent = mission.completed ? "Completed" : "Active";
    meta.append(number, status);

    const title = document.createElement("h3");
    title.textContent = mission.title;
    if (mission.privateAssignment && !mission.completed) {
      const privateCopy = document.createElement("p");
      privateCopy.className = "private-assignment-copy";
      privateCopy.textContent = "This one is for you.";
      article.append(meta, privateCopy, title);
    } else {
      article.append(meta, title);
    }
    const description = document.createElement("p");
    description.textContent = mission.description;
    const reward = document.createElement("p");
    reward.className = "mission-reward";
    reward.textContent = mission.completed
      ? `+${mission.keysEarned} ${mission.keysEarned === 1 ? "KEY" : "KEYS"} EARNED`
      : `${mission.keyReward} ${mission.keyReward === 1 ? "KEY" : "KEYS"}`;
    article.append(description, reward);
    if (!mission.completed || mission.repeatable) article.append(makeClaimForm(mission));
    return article;
  }));
}

function makeClaimForm(mission) {
  const form = document.createElement("form");
  form.className = "mission-claim-form";
  if (mission.verificationRequired) {
    const label = document.createElement("label");
    label.textContent = "Mission code";
    const input = document.createElement("input");
    input.name = "verificationCode";
    input.type = "text";
    input.minLength = 4;
    input.maxLength = 40;
    input.autocomplete = "off";
    input.placeholder = "Enter your code";
    input.required = true;
    label.append(input);
    form.append(label);
  }
  const button = document.createElement("button");
  button.className = "mission-claim-button";
  button.type = "submit";
  button.textContent = mission.verificationRequired ? "Unlock Keys" : "Claim Keys";
  const message = document.createElement("p");
  message.className = "mission-claim-message";
  message.setAttribute("aria-live", "polite");
  form.append(button, message);
  form.addEventListener("submit", (event) => claimMission(event, mission));
  return form;
}

async function claimMission(event, mission) {
  event.preventDefault();
  const form = event.currentTarget;
  const button = form.querySelector("button");
  const message = form.querySelector(".mission-claim-message");
  const verificationCode = new FormData(form).get("verificationCode")?.toString() || "";
  button.disabled = true;
  button.textContent = "Claiming…";
  message.textContent = "";
  try {
    const response = await fetch(`${API_BASE_URL}/api/missions/claim`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cardId,
        missionCode: mission.code,
        verificationCode,
        idempotencyKey: crypto.randomUUID().replaceAll("-", "")
      })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "We couldn’t claim this mission.");
    renderPassport(result.passport);
  } catch (error) {
    message.textContent = error.message;
    button.disabled = false;
    button.textContent = mission.verificationRequired ? "Unlock Keys" : "Claim Keys";
  }
}

function showKeyAward(transaction) {
  if (!transaction || transaction.amount < 1) return;
  const storageKey = `justbaila-seen-key-transaction:${cardId}`;
  try {
    if (window.localStorage.getItem(storageKey) === transaction.id) return;
    window.localStorage.setItem(storageKey, transaction.id);
  } catch {}

  const award = document.querySelector("#key-award");
  award.textContent = `MISSION COMPLETE // +${transaction.amount} ${transaction.amount === 1 ? "KEY" : "KEYS"}`;
  award.hidden = false;
  window.setTimeout(() => award.classList.add("is-visible"), 50);
  window.setTimeout(() => {
    award.classList.remove("is-visible");
    window.setTimeout(() => { award.hidden = true; }, 500);
  }, 5000);
}

function showState(activeState, label) {
  Object.entries(states).forEach(([name, element]) => { element.hidden = name !== activeState; });
  gatedContent.forEach((section) => { section.hidden = activeState !== "passport"; });
  accessSeal.hidden = true;
  accessSeal.classList.remove("has-private-assignment");
  accessLabel.textContent = label;
}

function formatDate(value) {
  if (!value) return "today";
  const normalized = value.includes("T") ? value : `${value.replace(" ", "T")}Z`;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return "recently";
  return new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric" }).format(date);
}

function getInitials(name) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0].toUpperCase()).join("");
}
