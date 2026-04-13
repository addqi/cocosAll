import { Camera } from 'cc';
import { CameraController } from './CameraController';

export function getMainCamera(): Camera | null {
    return CameraController.inst.camera;
}
