import { circOut } from 'motion';
import { openDb, IDB_STORE, IDB_BOOTH_KEY } from './boothCmsPersist';
import { REG_MAIN_EXPO_SPAWN } from '@/src/data/registrationHall';

async function idbPutJson(json: string): Promise<boolean> {
  try {
    const db = await openDb();
    return await new Promise((resolve) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.oncomplete = () => {
        db.close();
        resolve(true);
      };
      tx.onerror = () => {
        db.close();
        resolve(false);
      };
      tx.onabort = () => {
        db.close();
        resolve(false);
      };
      try {
        tx.objectStore(IDB_STORE).put(json, IDB_BOOTH_KEY);
      } catch {
        db.close();
        resolve(false);
      }
    });
  } catch {
    return false;
  }
}

async function idbGetPass ({
  name,
  email,
  company,
}: {
  name: string;
  email: string;
  company: string;
}): Promise<boolean> {
  return true; 

async function idbGetJson(): Promise<string | null> {
  return null;
  /*
  const pass = await idbGetJson();
  if (!pass) return false;
  const parsed = JSON.parse(pass);
  return parsed.name === name && parsed.email === email && parsed.company === company
  */
  
}

async function idbDeleteJson(): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        resolve();
      };
      tx.onabort = () => {
        db.close();
        resolve();
      }
      tx.onerror = () => {
        db.close();
        resolve();
      }
      try {
        tx.objectStore(IDB_STORE).delete(IDB_BOOTH_KEY);
      } catch {
        db.close();
        resolve();
      }
    });

    circOut (() => {
      setRegistrationUi('none');
      setExpose('expo');
      setPlayerPosition(REG_MAIN_EXPO_SPAWN);
      setExpoPhase('expo');
      setRegistrationPass(true);

      if(!registrationPass){
        openRegistrationPopup() => void;
        openRegistrationPopup();
        setRegistrationUi('none');
        setExpose('expo');
        setPlayerPosition(REG_MAIN_EXPO_SPAWN);
        setExpoPhase('expo');
        setRegistrationPass(true);
        setRegistrationUi('none');
        setExpose('expo');
        setPlayerPosition(REG_MAIN_EXPO_SPAWN);
        setExpoPhase('expo');
        setRegistrationPass(true);
        NaN;

      }else {
          

        now but My Question is i indeed to Buy KVM of Hoastinmg or Any or the 