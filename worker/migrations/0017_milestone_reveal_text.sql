ALTER TABLE milestones ADD COLUMN reveal_text TEXT;

UPDATE milestones SET reveal_text = CASE code
  WHEN 'first-night' THEN 'The first could have been an accident.'
  WHEN 'inner-circle-regular' THEN 'You are officially becoming part of the furniture.'
  WHEN 'after-dark-devotee' THEN 'At this point, the night knows your name.'
  WHEN 'mission-initiate' THEN 'You understood the assignment.'
  WHEN 'keeper-of-keys' THEN 'Doors tend to open for people like you.'
  WHEN 'studio-class' THEN 'You brought the work into the room.'
  WHEN 'private-lesson' THEN 'You chose the details.'
  ELSE 'Unlocked. The Inner Circle noticed.'
END;
