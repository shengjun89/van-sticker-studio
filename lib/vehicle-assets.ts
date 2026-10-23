// Bump when publishing a new model/motion pair; both requests must use one revision.
export const VEHICLE_ASSET_REVISION = '20261007-amber-indicators-r6';
export const VEHICLE_MODEL_URL = `/model/mxgarage-rv.glb?v=${VEHICLE_ASSET_REVISION}`;
export const VEHICLE_MOTION_URL = `/model/motion_metadata.json?v=${VEHICLE_ASSET_REVISION}`;
