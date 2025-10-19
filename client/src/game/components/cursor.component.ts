import { Component, EntityId } from '@typeonce/ecs';
import { GrabbedComponent } from './grabbed.component';
import { MouseListener } from '../mouse.listener';

export class Cursor extends Component('Cursor')<{
    listener: MouseListener;
    grabbedEvents: { id: EntityId; component: GrabbedComponent }[];
}> {}
