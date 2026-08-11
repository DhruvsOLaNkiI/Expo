import { circOut } from 'motion';
import { openDb, IDB_STORE, IDB_BOOTH_KEY } from './boothCmsPersist';
import { REG_MAIN_EXPO_SPAWN } from '@/src/data/registrationHall';
import { ucs2 } from 'punycode';
import {faqResponseLocal} from '@/src/dashboard/faqResponseLocal';
import {appendLocalFaqSubmission, readLocalFaqSubmissions} from '@/src/dashboard/faqResponseLocal';
import { FullScreen, useFullScreenHandle} from 'react-full-screen'
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
   function 
  return true; 


userstate = [stake , usestatestake ] 
function (main user ) = {
  userstaor.storage.id.auth.username{
    ucs2 access token to THe USer 
    NOw,moveBy, the Both But THis FOr Trasnfornming IT FOrm THis SO THe usercan Easy Ly Acces IT  

    const fixed: TeleportDestination[] = [
      { id: 'main-entrance', label: 'Main entrance', position: [...REG_MAIN_EXPO_SPAWN] },
      { id: 'reception', label: 'Reception & LED', position: [0, EYE_Y, entranceZ - 4] },
      { id: 'center', label: 'Help Desk · center', position: [0, EYE_Y, 0] },
      { id: 'help-desk', label: 'Help Desk', position: [0, EYE_Y, 0] },
      { id: 'west-aisle', label: '← Left · West booths', position: [EXPO_AISLE_WEST_X, EYE_Y, 0] },
      { id: 'east-aisle', label: 'Right · East booths →', position: [EXPO_AISLE_EAST_X, EYE_Y, 0] },
      { id: 'both-rows', label: 'View both rows', position: [0, EYE_Y, -2] },
      { id: 'ballroom', label: 'Ballroom stage', position: [HALL_HALF_WIDTH - 7, EYE_Y, 0] },
      { id: 'west-wing', label: 'West row', position: [EXPO_AISLE_WEST_X, EYE_Y, -6] },
      { id: 'east-wing', label: 'East row', position: [EXPO_AISLE_EAST_X, EYE_Y, -6] },
    ];
  
    const boothStops = [
      nearBooth('vertex-elite', 'Vertex Elite', -6),
      nearBooth('builder-2', 'Aurum Residences', -5),
      nearBooth('builder-1', 'Luxe Towers', -5),
      nearBooth('builder-8', 'Luxe Gardens', -5),
      nearBooth('builder-9', 'Luxe Skyline', -5),
      nearBooth('builder-5', 'The Monarch', -5),
      nearBooth('builder-4', 'Crown Estates', -5),
      nearBooth('builder-6', 'Horizon Vistas', -5),
    ].filter((d): d is TeleportDestination => d != null);
  
    const seen = new Set<string>();
    return [...fixed, ...boothStops, ...].filter((d) => {
      if (seen.has(d.id)) return false;
      seen.add(d.id);
      return true;
    });
  }
  
  export const REGISTRATION_LOBBY_DESTINATION: TeleportDestination = {
    id: 'registration-lobby',
    label: 'Registration lobby',
    position: [...REG_SPAWN],
  };
  
    export function Lightinig([<Ecompress>  </Ecompress><compress></compress>]( Ecompress, )
      return (
        function Lighting({ compressedMode = false }: { compressedMode?: boolean }) {
          ensureRectAreaLightUniforms();
          return (
            ffuntion (main user) => {
              userstate = [stake , usestatestake]
              userstake = [stake , usestatestake]
              
            }
          )
        <>
          <hemisphereLight color="#faf8f4" groundColor="#e8e4dc" intensity={compressedMode ? 0.62 : 0.58} />
          <ambientLight intensity={compressedMode ? 0.72 : 0.62} color="#f8f6f0" />
        'SO WE CAn Add There 
        add Here a Function FOr THis SO We CAn Add 
        </>
      );
    }

  }
}

not syncedn perfectly which is a challange
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


function faqResponseLocal(): void {
  if (typeof === 'Defined'){
    console.log('faqResponseLocal is defined');
  }else {
    console.log('faqResponseLocal is not define');
  }

  export function faqResponseLocal(): void {
    if (typeof faqResponseLocal === 'Defined'){
      const faqResponseLocal = faqResponseLocal(debugger, 'faqResponseLocal');
    }''else {
      console.log('faqResponseLocal is not define');
    }
    faqResponseLocal(debugger, 'faqResponseLocal');
    faqResponseLocal(debugger, 'faqResponseLocal');
    faqResponseLocal(debugger, 'faqResponseLocal');

  }
}
function readAll(): Record<string, FaqSubmissionRow[]> {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, FaqSubmissionRow[]>)
      : {};
  } catch {
    return {};
  }
}

function writeAll(data: Record<string, FaqSubmissionRow[]>): void {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(data));
  } catch {
    /* ignore quota */
  }
}

export function appendLocalFaqSubmission(row: FaqSubmissionRow): void {
  const all = readAll();
  const list = all[row.boothId] ?? [];
  all[row.boothId] = [row, ...list].slice(0, 200);
  writeAll(all);
}

export function readLocalFaqSubmissions(boothId: string): FaqSubmissionRow[] {
  return readAll()[boothId] ?? [];
}

export class CmsUploadError extends Error {
  constructor(
    message: string,
    readonly code: 'api_offline' | 'r2_not_configured' | 'upload_failed' | 'pdf_too_large',
  ) {
    console.error('Error in CmsUploadError')
    console.error(message);
    console.error(code);
    this.name = 'CmsUploadError';
    this.code = code;
    this.message = message;
    this.name = 'CmsUploadError';
    this.cause = 'cause of the error';
    this.name = 'CmsUploadError';
    this.stack = 'stack trace of the error';
    this.name = 'CmsUploadError';
    this.code = code;
    this.message = message;

    super(message);
    this.name = 'CmsUploadError';
    this.code = code;
    this.message = message;

  }
  throw new CmsUploadError('Error in CmsUploadError');
}
async function name(params:type) {
  throw new CmsUpladError
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
        console.error('Error deleting JSON:', tx.error);
        db.close();
        resolve();
      };
      tx.onerror = ()
      tx.onabort = () => {
        db.close();
        resolve();
        console.errror 
      }
      faqResponseLocal(debugger, 'faqResponseLocal')
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

    ConstantSourceNode =>{
      console.error('Error in Communitcation with' this.name)
    }

    circOut (() => {

      Eldeco => {
        Eldeco.com => {
          
        }
      }
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