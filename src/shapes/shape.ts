/* eslint-disable no-redeclare */
import { Color, HorizontalAlignment, Length, Observable, PercentLength, Utils, VerticalAlignment, Visibility } from '@nativescript/core';
import { booleanConverter } from '@nativescript/core/ui/core/view-base';
import { Canvas, CanvasView, Cap, Join, Paint, Style } from '../canvas';
import { parseCap, parseDashEffect, parseJoin, parseShadow, parseType } from '../utils';

function parseThickness(value: string) {
    if (typeof value === 'string') {
        const arr = value.split(/[ ,]+/);

        let top: string;
        let right: string;
        let bottom: string;
        let left: string;

        if (arr.length === 1) {
            top = arr[0];
            right = arr[0];
            bottom = arr[0];
            left = arr[0];
        } else if (arr.length === 2) {
            top = arr[0];
            bottom = arr[0];
            right = arr[1];
            left = arr[1];
        } else if (arr.length === 3) {
            top = arr[0];
            right = arr[1];
            left = arr[1];
            bottom = arr[2];
        } else if (arr.length === 4) {
            top = arr[0];
            right = arr[1];
            bottom = arr[2];
            left = arr[3];
        } else {
            throw new Error('Expected 1, 2, 3 or 4 parameters. Actual: ' + value);
        }

        return {
            top,
            right,
            bottom,
            left,
        };
    } else {
        return value;
    }
}

function createGetter(key, options: ShapePropertyOptions) {
    const realKey = '_' + key.toString();
    return function () {
        if (options.paintGetterName && this.paint[options.paintGetterName]) {
            return this.paint[options.paintGetterName]();
        } else {
            return this[realKey];
        }
    };
}

function hasSetter(obj, prop) {
    const descriptor = Object.getOwnPropertyDescriptor(obj, prop);
    return descriptor && !!descriptor['set'];
}

export interface ShapePropertyOptions {
    converter?: Function;
    paintGetterName?: string;
    paintSetterName?: string;
    nonPaintProp?: boolean;
    paintSetter?: (paint: Paint, value: any) => void;
}
function createSetter(key, options: ShapePropertyOptions) {
    const realKey = '_' + key.toString();
    const nativeSetter = 'set' + key.charAt(0).toUpperCase() + key.slice(1);
    return function (newVal) {
        const oldValue = this[realKey];
        const actualVal = options.converter ? options.converter(newVal) : newVal;
        this[realKey] = actualVal;
        if (options.nonPaintProp !== true) {
            if (options.paintSetter) {
                options.paintSetter(this.paint, actualVal);
            } else if (options.paintSetterName) {
                if (this.paint[options.paintSetterName]) {
                    this.paint[options.paintSetterName](actualVal);
                }
            } else {
                if ((this.paint && this.paint.hasOwnProperty(key)) || hasSetter(this.paint, key)) {
                    this.paint[key] = actualVal;
                } else {
                    if (this.paint[nativeSetter]) {
                        this.paint[nativeSetter](actualVal);
                    }
                }
            }
        }

        this.notifyPropertyChange(key, actualVal, oldValue);
    };
}

function shapePropertyGenerator(target: Object, key: string | symbol, options?: ShapePropertyOptions) {
    Object.defineProperty(target, key, {
        get: createGetter(key, options),
        set: createSetter(key, options),
        enumerable: true,
        configurable: true,
    });

    // for svelte!
    Object.defineProperty(target, key.toString().toLowerCase(), {
        get: createGetter(key, options),
        set: createSetter(key, options),
        enumerable: true,
        configurable: true,
    });
}
// export function shapeProperty(target: any, k?, desc?: PropertyDescriptor): any;
// export function shapeProperty(options: ShapePropertyOptions): (target: any, k?, desc?: PropertyDescriptor) => any;
export function shapeProperty(converter, args) {
    if (args.length === 1 && typeof args[0] === 'object') {
        const options = args[0];
        // factory
        if (!options.converter) {
            options.converter = converter;
        }
        return function (target: any, key?: string, descriptor?: PropertyDescriptor) {
            return shapePropertyGenerator(target, key, options);
        };
    } else {
        return shapePropertyGenerator(args[0], args[1], { converter });
    }
}

export function stringProperty(target: any, k?, desc?: PropertyDescriptor): any;
export function stringProperty(options: ShapePropertyOptions): (target: any, k?, desc?: PropertyDescriptor) => any;
export function stringProperty(...args) {
    return shapeProperty(undefined, args);
}
export function colorProperty(target: any, k?, desc?: PropertyDescriptor): any;
export function colorProperty(options: ShapePropertyOptions): (target: any, k?, desc?: PropertyDescriptor) => any;
export function colorProperty(...args) {
    return shapeProperty((v) => (v instanceof Color ? v : v ? new Color(v) : null), args);
}
export function lengthProperty(target: any, k?, desc?: PropertyDescriptor): any;
export function lengthProperty(options: ShapePropertyOptions): (target: any, k?, desc?: PropertyDescriptor) => any;
export function lengthProperty(...args) {
    return shapeProperty((v) => Length.parse(v), args);
}
export function percentLengthProperty(target: any, k?, desc?: PropertyDescriptor): any;
export function percentLengthProperty(options: ShapePropertyOptions): (target: any, k?, desc?: PropertyDescriptor) => any;
export function percentLengthProperty(...args) {
    return shapeProperty((v) => PercentLength.parse(v), args);
}
export function numberProperty(target: any, k?, desc?: PropertyDescriptor): any;
export function numberProperty(options: ShapePropertyOptions): (target: any, k?, desc?: PropertyDescriptor) => any;
export function numberProperty(...args) {
    return shapeProperty((v) => parseFloat(v), args);
}
export function booleanProperty(target: any, k?, desc?: PropertyDescriptor): any;
export function booleanProperty(options: ShapePropertyOptions): (target: any, k?, desc?: PropertyDescriptor) => any;
export function booleanProperty(...args) {
    return shapeProperty((v) => booleanConverter(v), args);
}

export interface Shadow {
    dx: number;
    dy: number;
    radius: number;
    color: Color;
}

function applyShadow(paint: Paint, shadow: Shadow) {
    if (shadow) {
        paint.setShadowLayer(shadow.radius, shadow.dx, shadow.dy, shadow.color);
    } else {
        paint.clearShadowLayer();
    }
}
export default abstract class Shape extends Observable {
    _paint: Paint;
    _parent: WeakRef<CanvasView>;
    get paint() {
        if (!this._paint) {
            // const startTime = Date.now();
            this._paint = new Paint();
            // this.log('create paint', Date.now() - startTime, 'ms');
        }
        return this._paint;
    }
    log(...args) {
        return console.log(this.toString(), ...args);
    }

    id: string;
    toString() {
        return `[${this.constructor.name}]${this.id ? `<${this.id}>` : ''}`;
    }
    // paint = new Paint();
    @colorProperty fillColor: Color;
    @colorProperty strokeColor: Color;
    @colorProperty color: Color;
    @lengthProperty strokeWidth: number;
    @stringProperty({ converter: parseDashEffect, paintSetterName: 'setPathEffect' }) dash: string;
    @numberProperty({ converter: parseType, paintSetterName: 'setStyle' }) paintStyle: Style;
    @numberProperty({ converter: parseCap }) strokeCap: Cap;
    @numberProperty({ converter: parseJoin }) strokeJoin: Join;
    @numberProperty textSize: number;
    // alias for textSize
    @numberProperty({ paintSetterName: 'setTextSize' }) fontSize: number;
    @booleanProperty({ paintGetterName: 'isAntiAlias', paintSetterName: 'setAntiAlias' }) antiAlias: boolean;
    @colorProperty({
        converter: parseShadow,
        paintSetter: applyShadow,
    })
    shadow: Shadow;
    @stringProperty({ nonPaintProp: true }) visibility: Visibility = 'visible';
    @stringProperty({ nonPaintProp: true }) horizontalAlignment: HorizontalAlignment & 'middle';
    @stringProperty({ nonPaintProp: true }) verticalAlignment: VerticalAlignment & 'center';

    @percentLengthProperty({ nonPaintProp: true }) width: PercentLength;
    @percentLengthProperty({ nonPaintProp: true }) height: PercentLength;


    @percentLengthProperty({ nonPaintProp: true }) paddingLeft: PercentLength;
    @percentLengthProperty({ nonPaintProp: true }) paddingRight: PercentLength;
    @percentLengthProperty({ nonPaintProp: true }) paddingBottom: PercentLength;
    @percentLengthProperty({ nonPaintProp: true }) paddingTop: PercentLength;

    @percentLengthProperty({ nonPaintProp: true }) marginLeft: PercentLength;
    @percentLengthProperty({ nonPaintProp: true }) marginRight: PercentLength;
    @percentLengthProperty({ nonPaintProp: true }) marginTop: PercentLength;
    @percentLengthProperty({ nonPaintProp: true }) marginBottom: PercentLength;

    protected handleAlignment = false;

    abstract drawOnCanvas(canvas: Canvas, parent: CanvasView): void;

    getWidth(availableWidth: number, availableHeight: number) {
        return this.width? Utils.layout.toDeviceIndependentPixels(PercentLength.toDevicePixels(this.width, 0, availableWidth)) : 0;
    }
    getHeight(availableWidth: number, availableHeight: number) {
        return this.height? Utils.layout.toDeviceIndependentPixels(PercentLength.toDevicePixels(this.height, 0, availableHeight)) : 0;

    }

    drawMyShapeOnCanvas(canvas: Canvas, parent: CanvasView, width: number, height: number) {
        if (this.visibility !== 'visible') {
            return;
        }
        if (!this.handleAlignment) {
            const availableWidth = Utils.layout.toDevicePixels(canvas.getWidth());
            const availableHeight = Utils.layout.toDevicePixels(canvas.getHeight());
            const paddingLeft = Utils.layout.toDeviceIndependentPixels(parent.effectivePaddingLeft + PercentLength.toDevicePixels(this.paddingLeft, 0, availableWidth) + parent.effectiveBorderLeftWidth);
            const paddingRight = Utils.layout.toDeviceIndependentPixels(parent.effectivePaddingRight  +PercentLength.toDevicePixels(this.paddingRight, 0, availableWidth)+ parent.effectiveBorderRightWidth);
            const paddingTop = Utils.layout.toDeviceIndependentPixels(parent.effectivePaddingTop + PercentLength.toDevicePixels(this.paddingTop, 0, availableHeight)+ parent.effectiveBorderTopWidth);
            const paddingBottom = Utils.layout.toDeviceIndependentPixels(parent.effectivePaddingBottom + PercentLength.toDevicePixels(this.paddingBottom, 0, availableHeight) + parent.effectiveBorderBottomWidth);
            canvas.save();
            if (paddingLeft > 0) {
                canvas.translate(paddingLeft, 0);
            }
            if (this.horizontalAlignment && this.horizontalAlignment !== 'left' && paddingRight > 0) {
                canvas.translate(-paddingRight, 0);
            }
            if (paddingTop > 0) {
                canvas.translate(0, paddingTop);
            }
            if (this.verticalAlignment && this.verticalAlignment !== 'top' && paddingBottom > 0) {
                canvas.translate(0, -paddingBottom);
            }
            if (this.horizontalAlignment === 'right') {
                const sWidth = this.getWidth(availableWidth, availableHeight);
                canvas.translate(width - sWidth, 0);
            } else if (this.horizontalAlignment === 'center' || this.horizontalAlignment === 'middle') {
                const sWidth = this.getWidth(availableWidth, availableHeight);
                canvas.translate(width / 2 - sWidth/2, 0);
            }
            if (this.verticalAlignment === 'bottom') {
                const sHeight = this.getHeight(availableWidth, availableHeight);
                canvas.translate(0, height - sHeight);
            } else if (this.verticalAlignment === 'center' || this.verticalAlignment === 'middle') {
                const sHeight = this.getHeight(availableWidth, availableHeight);
                canvas.translate(0, height / 2 - sHeight/2);
            }
        }

        const paint = this.paint;
        // console.log('drawMyShapeOnCanvas', paint.getColor(), this.strokeColor, this.fillColor);
        if (this.strokeColor || this.fillColor) {
            const oldStyle = paint.getStyle();
            const oldColor = paint.getColor();
            if (this.fillColor) {
                paint.setStyle(Style.FILL);
                paint.setColor(this.fillColor);
                // paint.color = this.fillColor;
                this.drawOnCanvas(canvas, parent);
                paint.setStyle(oldStyle);
                paint.setColor(oldColor);
            }
            if (this.strokeColor) {
                const clearShadow = this.fillColor && this.shadow;
                if (clearShadow) {
                    paint.clearShadowLayer();
                }
                paint.setStyle(Style.STROKE);
                paint.setColor(this.strokeColor);
                this.drawOnCanvas(canvas, parent);
                paint.setStyle(oldStyle);
                paint.setColor(oldColor);
                if (clearShadow) {
                    applyShadow(paint, this.shadow);
                }
            }
        } else {
            this.drawOnCanvas(canvas, parent);
        }
        if (!this.handleAlignment) {
            canvas.restore();
        }
    }
}
