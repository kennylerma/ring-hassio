"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Subscribed = void 0;
class Subscribed {
    constructor() {
        this.subscriptions = [];
    }
    addSubscriptions(...subscriptions) {
        this.subscriptions.push(...subscriptions);
    }
    unsubscribe() {
        this.subscriptions.forEach((subscription) => subscription.unsubscribe());
    }
}
exports.Subscribed = Subscribed;
