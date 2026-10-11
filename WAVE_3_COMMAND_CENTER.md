# Underground Wave 3 — Command Center

## Operator surfaces

- **Live Floor** polls the existing meaningful activity feed every 30 seconds by default and supports operational filters.
- **Tonight** combines the selected event's checked-in members, consented Overlap opportunities, watched members, Dead Drops, Ghost Missions, and temporary Signals.
- **Switchboard** summarizes currently active operator-controlled experiences; authoritative editors remain in their owning sections.
- **Member context** includes a derived Pulse, private Watchlist state, and timestamped private dossier notes.

## Technique Lab skill model

Targets and Overlap extend the existing `technique_competencies` catalog. Existing Technique evaluation rows continue to reference the same competency IDs.

- Members may keep at most three active Targets.
- Target self-state is `learning`, `working`, or `comfortable` and remains separate from instructor evaluation state.
- `available_to_help` and `open_to_overlap` both default off and require explicit member action.
- Instructor/admin suggestions create a Lab Note; they never consume a Target slot until accepted.
- Complementary skill relationships are stored in both directions in `technique_complementarity`.
- Overlap Radar considers only corrected event attendance, active eligible skills, role compatibility, and members who opted in.

## Temporary systems

- **Manual transmissions** are scoped to one member, selected members, or an event; limited to 200 recipients; and expire within 72 hours.
- **Dead Drops** use plain text and bounded action types, with start/expiration, eligibility, maximum claims, and one claim per member.
- **Ghost Missions** use a bounded trigger list. They are removed from the member mission response until eligible.

## Privacy and authorization

All operator mutations remain behind the existing Worker admin authentication. Instructor Technique controls retain their existing server-side role check. Watchlist state and dossier notes are returned only by admin endpoints and are deliberately absent from public passport responses.

## Deliberately not invented

The supplied Wave 3 brief references **Anomalies** and a **Randomizer** only in its test checklist, without defining either feature. Neither system was created. No randomizer executes actions, and no temporary override can bypass existing authorization. These concepts need a product definition before implementation.
