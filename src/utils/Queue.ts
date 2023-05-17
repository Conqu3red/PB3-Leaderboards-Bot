export default class Queue<T> {
    head: number;
    tail: number;
    initialCapacity: number;
    internalLength: number;
    currentSize: number;
    container: T[];

    constructor(initialCapacity?: number) {
        this.head = 0;
        this.tail = 0;
        this.internalLength = 0;
        this.initialCapacity = initialCapacity ?? 200;
        this.currentSize = this.initialCapacity;
        this.container = [];
        this.container.length = this.currentSize;
    }

    private doubling() {
        var currentSource = this.head;
        var currentTarget = 0;
        var newContainer = [];
        newContainer.length = 2 * this.currentSize;

        while (currentTarget < this.currentSize) {
            newContainer[currentTarget] = this.container[currentSource];
            currentSource++;
            currentTarget++;
            if (currentSource == this.currentSize) {
                currentSource = 0;
            }
        }
        this.container = newContainer;
        this.head = 0;
        this.tail = this.currentSize;
        this.currentSize *= 2;
    }

    private shrink() {
        var currentSource = this.head;
        var currentTarget = 0;
        var newContainer = [];
        newContainer.length = this.currentSize / 4;

        while (currentTarget < this.currentSize) {
            newContainer[currentTarget] = this.container[currentSource];
            currentSource++;
            currentTarget++;
            if (currentSource == this.currentSize) {
                currentSource = 0;
            }
        }
        this.container = newContainer;
        this.head = 0;
        this.tail = this.currentSize;
        this.currentSize /= 4;
    }

    push(element: T) {
        if (this.internalLength == this.currentSize) {
            this.doubling();
        }
        this.container[this.tail] = element;
        this.internalLength++;
        this.tail++;
        if (this.tail == this.currentSize) {
            this.tail = 0;
        }
    }

    shift() {
        if (length === 0) {
            return null;
        }
        let tmp = this.container[this.head];
        this.head++;
        this.internalLength--;
        if (this.head == this.currentSize) {
            this.head = 0;
        }
        if (length == this.currentSize / 4 && length > this.initialCapacity) {
            this.shrink();
        }
        return tmp;
    }

    front() {
        if (length === 0) {
            return null;
        }
        return this.container[this.head];
    }

    length() {
        return this.internalLength;
    }

    isEmpty() {
        return this.internalLength === 0;
    }
}
