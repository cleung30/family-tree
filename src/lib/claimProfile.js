// Turns "I am <relType> <relatedPersonId>" into the person1/person2/type
// shape the relationships table expects, from the new person's point of
// view (relType describes what the new person is to the existing one).
export function buildClaimRelationship(newPersonId, relType, relatedPersonId) {
  if (relType === 'child') return { person1_id: relatedPersonId, person2_id: newPersonId, type: 'parent' }
  if (relType === 'parent') return { person1_id: newPersonId, person2_id: relatedPersonId, type: 'parent' }
  return { person1_id: newPersonId, person2_id: relatedPersonId, type: 'spouse' }
}
