from pathlib import Path

path=Path('apps-script-v2/Phase2ControlledTests.js')
text=path.read_text(encoding='utf-8')
if 'sacPack:v2SacPackControlledTest' in text:
    print('SAC pack already part of Phase 2 controlled suite.')
    raise SystemExit(0)
old="""  const offerAcceptance = v2OfferAcceptanceEndToEndControlledTest();
  const report = {
    ok: !!(manual && manual.ok && ai && ai.ok && offerAcceptance && offerAcceptance.ok),
    manualScreening:manual,
    aiAuto:ai,
    offerAcceptance:offerAcceptance,
    v1Touched:false
  };"""
new="""  const offerAcceptance = v2OfferAcceptanceEndToEndControlledTest();
  const sacPack=v2SacPackControlledTest();
  const report = {
    ok: !!(manual && manual.ok && ai && ai.ok && offerAcceptance && offerAcceptance.ok && sacPack && sacPack.ok),
    manualScreening:manual,
    aiAuto:ai,
    offerAcceptance:offerAcceptance,
    sacPack:sacPack,
    v1Touched:false
  };"""
if old not in text:
    raise SystemExit('Phase 2 suite patch target not found')
path.write_text(text.replace(old,new,1),encoding='utf-8')
print('Added SAC pack controlled test to Phase 2 suite.')
