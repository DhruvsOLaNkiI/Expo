import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..', 'src');

const components = [
  ['Player', 'features/expo/components/Player'],
  ['ExpoHall', 'features/expo/components/ExpoHall'],
  ['Lighting', 'features/expo/components/Lighting'],
  ['Effects', 'features/expo/components/Effects'],
  ['HallLayoutGizmos', 'features/expo/components/HallLayoutGizmos'],
  ['HallLayoutEditHud', 'features/expo/components/HallLayoutEditHud'],
  ['LocalVisitorAvatar', 'features/expo/components/LocalVisitorAvatar'],
  ['CameraModeHud', 'features/expo/components/CameraModeHud'],
  ['SceneQualityHud', 'features/expo/components/SceneQualityHud'],
  ['ExpoSceneSettingsHud', 'features/expo/components/ExpoSceneSettingsHud'],
  ['RoamingExecutive', 'features/expo/components/RoamingExecutive'],
  ['Booths', 'features/booths/components/Booths'],
  ['MonarchBooth', 'features/booths/components/MonarchBooth'],
  ['HorizonVistasBooth', 'features/booths/components/HorizonVistasBooth'],
  ['CrownEstatesBooth', 'features/booths/components/CrownEstatesBooth'],
  ['SideExpoBooths', 'features/booths/components/SideExpoBooths'],
  ['HallAisleStandees', 'features/booths/components/HallAisleStandees'],
  ['HallSuspendedCanopy', 'features/booths/components/HallSuspendedCanopy'],
  ['VertexEliteCanopyBranding', 'features/booths/components/VertexEliteCanopyBranding'],
  ['VertexEliteCtaKiosk', 'features/booths/components/VertexEliteCtaKiosk'],
  ['VertexEliteProximityPanels', 'features/booths/components/VertexEliteProximityPanels'],
  ['VertexEliteScreenHud', 'features/booths/components/VertexEliteScreenHud'],
  ['BoothPlacedImageInteractive', 'features/booths/components/BoothPlacedImageInteractive'],
  ['Ballroom', 'features/booths/components/Ballroom'],
  ['BoothCmsPreview', 'features/booths/components/BoothCmsPreview'],
  ['BoothCmsPanel', 'features/booths/components/BoothCmsPanel'],
  ['RegistrationHall', 'features/registration/components/RegistrationHall'],
  ['RegistrationLobbyHud', 'features/registration/components/RegistrationLobbyHud'],
  ['RegistrationLobbyLighting', 'features/registration/components/RegistrationLobbyLighting'],
  ['AiChatbox', 'features/ai/components/AiChatbox'],
  ['HelpDeskAiPanel', 'features/ai/components/HelpDeskAiPanel'],
  ['FastTravelHud', 'features/teleport/FastTravelHud'],
  ['VisitorOnboarding', 'features/visitor/components/VisitorOnboarding'],
  ['VisitorBadge', 'features/visitor/components/VisitorBadge'],
  ['LedVideoPlane', 'features/media/components/LedVideoPlane'],
  ['CtaResourcePopup', 'features/media/components/CtaResourcePopup'],
  ['VideoEnabledHint', 'features/media/components/VideoEnabledHint'],
  ['LayoutEditableGroup', 'features/shared/LayoutEditableGroup'],
];

fs.mkdirSync(path.join(root, 'components'), { recursive: true });
for (const [name, mod] of components) {
  fs.writeFileSync(
    path.join(root, 'components', `${name}.tsx`),
    `export * from '../${mod}';\n`,
  );
}

const shims = [
  ['cms/CmsDashboard.tsx', "export * from '../features/cms/CmsDashboard';\n"],
  ['cms/CmsScenePanel.tsx', "export * from '../features/cms/CmsScenePanel';\n"],
  ['cms/CmsPreview3D.tsx', "export * from '../features/cms/CmsPreview3D';\n"],
  ['PageIndexPortal.tsx', "export { PageIndexPortal as default, PageIndexPortal } from './features/pageindex/PageIndexPortal';\n"],
  ['boothCmsPersist.ts', "export * from './store/persist/boothCms';\n"],
  ['hallLayoutPersist.ts', "export * from './store/persist/hallLayout';\n"],
  ['helpDeskPersist.ts', "export * from './store/persist/helpDesk';\n"],
  ['visitorProfile.ts', "export * from './features/visitor/visitorProfile';\n"],
];

for (const [file, content] of shims) {
  fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
  fs.writeFileSync(path.join(root, file), content);
}

if (fs.existsSync(path.join(root, 'layoutRegistry.ts'))) {
  /* keep */
} else if (fs.existsSync(path.join(root, 'features/shared/layoutRegistry.ts'))) {
  fs.writeFileSync(path.join(root, 'layoutRegistry.ts'), "export * from './features/shared/layoutRegistry';\n");
}

console.log('Shims generated');
