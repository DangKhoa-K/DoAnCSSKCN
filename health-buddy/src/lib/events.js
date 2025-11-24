// siêu nhẹ, không cần cài thêm thư viện
import { DeviceEventEmitter } from 'react-native';

export const EVENTS = {
  NUTRITION_UPDATED: 'nutrition-updated',
};

export function emit(evt, payload) {
  DeviceEventEmitter.emit(evt, payload);
}

export function on(evt, cb) {
  const sub = DeviceEventEmitter.addListener(evt, cb);
  return () => sub.remove();
}
