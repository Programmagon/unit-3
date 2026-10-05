import logoForLight from '../assets/logo.png';
import logoForDark  from '../assets/logo-on-dark.png';

/** Wortmarke in zwei Fassungen: das Original ist für hellen Grund gezeichnet
 *  („UN“ ist dunkel), die „-on-dark“-Fassung hat angehobene Schatten
 *  (Kontrast ≥ 3 : 1 auf dem dunklen Header). Welche sichtbar ist, entscheidet
 *  CSS über data-theme — kein JavaScript, kein Flackern.
 *  Import statt public/-Pfad: Vite hasht die Dateien und setzt den Pfad korrekt
 *  (auch bei späterem base-Pfad oder Tauri). */
export function Logo() {
  return (
    <>
      <img className="logo logo--for-dark"  src={logoForDark}  alt="Unit 3" width={142} height={34} draggable={false} />
      <img className="logo logo--for-light" src={logoForLight} alt="Unit 3" width={142} height={34} draggable={false} />
    </>
  );
}
