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

    // Called when the queue is 1/4 full. Halve the capacity (leaving it 1/2 full, so it doesn't immediately
    // grow or shrink again) and copy only the live elements, in order, to the front of the new container.
    // Previously this copied the whole old capacity and set `tail` to the old capacity, past the end of the
    // new container: `tail` then never wrapped, every push grew the array, and pushed elements were never
    // returned by shift().
    private shrink() {
        const newSize = this.currentSize / 2;
        const newContainer: T[] = [];
        newContainer.length = newSize;

        let currentSource = this.head;
        for (let i = 0; i < this.internalLength; i++) {
            newContainer[i] = this.container[currentSource];
            currentSource++;
            if (currentSource == this.currentSize) {
                currentSource = 0;
            }
        }
        this.container = newContainer;
        this.head = 0;
        this.tail = this.internalLength == newSize ? 0 : this.internalLength;
        this.currentSize = newSize;
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
        if (this.internalLength === 0) {
            return null;
        }
        let tmp = this.container[this.head];
        this.container[this.head] = undefined as T; // release the reference so it can be garbage collected
        this.head++;
        this.internalLength--;
        if (this.head == this.currentSize) {
            this.head = 0;
        }
        if (
            this.internalLength == this.currentSize / 4 &&
            this.internalLength > this.initialCapacity
        ) {
            this.shrink();
        }
        return tmp;
    }

    front() {
        if (this.internalLength === 0) {
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
