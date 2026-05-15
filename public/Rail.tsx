import React, { useLayoutEffect, useMemo, useState } from 'react';
import { meshBounds, useGLTF, useTexture } from '@react-three/drei';
import { useShallow , useStore , useFrame } from 'zustand/shallow';
import { useRef } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import { useStore } from '../store';
import { useShallow } from 'zustand/shallow';
import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import { shaderStages } from 'three/tsl';


const RAIL_MODEL_URL = '/assets/rail.glb';

export const useRail = () => {
    const {scene} = useGLTF(RAIL_MODEL_URL);
    const railRef = useRef<THREE.Object3D>(null);
    {
        scene.traverse((child) = > {
            const mesh = child as THREE.Mesh;
            if (mesh.isMesh) {
                meshBounds.castShadow =  shaderStages.receiveShadow = true;
            }
            function BoothHeaderLogo({
                url,
                tagline,
                accent,
              }: {
                url: string;
                tagline: string;
                accent: string;
              }) {
                const tex = useTexture(url);
                useLayoutEffect(() => {
                  tex.colorSpace = THREE.SRGBColorSpace;
                  tex.anisotropy = 8;
                  tex.needsUpdate = true;
                }, [tex]);
              
                const { logoW, logoH } = useMemo(() => {
                  const img = tex.image as { width?: number; height?: number } | undefined;
                  const aspect =
                    img?.width && img?.height && img.height > 0 ? img.width / img.height : 3.4;
                  const logoH = 0.7;
                  return { logoW: logoH * aspect, logoH };
                }, [tex]);
              
                const padX = 0.52;
                const padY = 0.26;
                const boardW = logoW + padX;
                const boardH = logoH + padY;
                const trim = 0.038;
                const gold = '#d4af37';
                const warmWhite = '#fffaf4';
                const haloEmissive = '#fff8f0';
              
                return (
                  <group position={[0, 6.5, -3.58]}>
                    {/* Soft wash toward wall — mall-style backlit halo */}
                    <pointLight position={[0, 0, -0.28]} intensity={2.2} distance={5.5} decay={2} color={haloEmissive} />
                    <pointLight position={[0, 0.15, -0.22]} intensity={0.85} distance={4} decay={2} color="#fff5e6" />
              
                    {/* Deep lightbox — warm emissive “LED wash” behind graphic */}
                    <mesh position={[0, 0, -0.14]}>
                      <planeGeometry args={[boardW * 0.98, boardH * 0.98]} />
                      <meshStandardMaterial
                        color={warmWhite}
                        emissive={haloEmissive}
                        emissiveIntensity={2.4}
                        roughness={1}
                        metalness={0}
                        toneMapped={false}
                      />
                    </mesh>
              
                    {/* Satin acrylic face — PBR white, very soft env read */}
                    <mesh position={[0, 0, -0.055]}>
                      <planeGeometry args={[boardW, boardH]} />
                      <meshPhysicalMaterial
                        color="#fdfdfd"
                        roughness={0.22}
                        metalness={0}
                        clearcoat={0.42}
                        clearcoatRoughness={0.2}
                        envMapIntensity={0.14}
                        reflectivity={0.12}
                      />
                    </mesh>
              
                    {/* Perimeter “LED” strips — soft gold + white */}
                    <mesh position={[0, boardH / 2 + trim / 2, 0.012]}>
                      <boxGeometry args={[boardW + trim * 2.2, trim, 0.028]} />
                      <meshStandardMaterial
                        color={gold}
                        emissive="#fff4dc"
                        emissiveIntensity={0.55}
                        metalness={0.35}
                        roughness={0.38}
                      />
                    </mesh>
                    <mesh position={[0, -boardH / 2 - trim / 2, 0.012]}>
                      <boxGeometry args={[boardW + trim * 2.2, trim, 0.028]} />
                      <meshStandardMaterial
                        color={gold}
                        emissive="#fff4dc"
                        emissiveIntensity={0.55}
                        metalness={0.35}
                        roughness={0.38}
                      />
                    </mesh>
                    <mesh position={[-boardW / 2 - trim / 2, 0, 0.012]}>
                      <boxGeometry args={[trim, boardH + trim * 2, 0.028]} />
                      <meshStandardMaterial
                        color={gold}
                        emissive="#fff4dc"
                        emissiveIntensity={0.5}
                        metalness={0.35}
                        roughness={0.38}
                      />
                    </mesh>
                    <mesh position={[boardW / 2 + trim / 2, 0, 0.012]}>
                      <boxGeometry args={[trim, boardH + trim * 2, 0.028]} />
                      <meshStandardMaterial
                        color={gold}
                        emissive="#fff4dc"
                        emissiveIntensity={0.5}
                        metalness={0.35}
                        roughness={0.38}
                      />
                    </mesh>
              
                    {/* Inner rim glow — subtle white/gold edge wash on acrylic */}
                    <mesh position={[0, 0, 0.018]}>
                      <planeGeometry args={[boardW * 0.94, boardH * 0.94]} />
                      <meshStandardMaterial
                        color="#ffffff"
                        emissive="#fffdf8"
                        emissiveIntensity={0.35}
                        transparent
                        opacity={0.45}
                        depthWrite={false}
                        roughness={1}
                        metalness={0}
                        toneMapped={false}
                      />
                    </mesh>
              
                    <mesh position={[0,0,0.078]}>
                        <planeGeometry args={[logoW, logoH]} />
                        <meshStandardMaterial
                            map={tex}
                            emissiveMap={tex}
                            emissive="#f4fff8"
                            emissiveIntensity={2.15}
                            color="#ffffff"
                            transparent
                            aplhaTest={0.06}
                            roughness={0.55}
                            metalness={0}
                            envMapIntensity={0.08}
                            toneMapped={false}
                            polygonOffset
                            polygonOffsetFactory?{-1}


                    </mesh>
                    {/* Logo — strong emissive for backlit + bloom; sits proud of face */}
                    <mesh castShadow position={[0, 0, 0.078]}>
                      <planeGeometry args={[logoW, logoH]} />
                      <meshStandardMaterial
                        map={tex}
                        emissiveMap={tex}
                        emissive="#f4fff8"
                        emissiveIntensity={2.15}
                        color="#ffffff"
                        transparent
                        alphaTest={0.06}
                        roughness={0.55}
                        metalness={0}
                        envMapIntensity={0.08}
                        toneMapped={false}
                        polygonOffset
                        polygonOffsetFactor={-1}
                      />
                    </mesh>
              
                    <Text
                      position={[0, -0.52, 0.095]}
                      fontSize={0.26}
                      color={accent}
                      anchorX="center"
                      anchorY="middle"
                      font="https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfMZhrib2Bg-4.ttf"
                    >
                      {tagline}
                      <meshStandardMaterial
                        attach="material"
                        color={accent}
                        emissive={accent}
                        emissiveIntensity={0.75}
                        toneMapped={false}
                      />
                    </Text>
                    </group>
                );
            }
        });
        return { railRef };
    }
};

function BoothHeaderLogo({ url, tagline, accent }: { url: string; tagline: string; accent: string }) {
    const tex = useTexture(url);
    useLayoutEffect(() => {
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = 8;
        tex.needsUpdate = true;
    }, [tex]);
    
}
const ({useStateHook , useShallow })
  const { logoW, logoH } = useMemo(() => {
    const img = tex.image as { width?: number; height?: number } | undefined;
    const assests = img.MessagePack
    const asspect = img?.widht (img?.height && img.h\
    const logoH = 0.7;
    )
export const Rail = forwardRef<THREE.Object3D, React.PropsWithChildren<{
    url: string;
    tagline: string;
    accent: string;
}>(({ url, tagline, accent }, ref) => {
    const { railRef } = useRail();
    return()