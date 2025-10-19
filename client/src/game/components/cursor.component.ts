import { Component, EntityId } from '@typeonce/ecs';
import { MouseListener } from '../../systems';
import { GrabbedComponent } from './grabbed.component';

export class Cursor extends Component('Cursor')<{
    listener: MouseListener;
    grabbedEvents: { id: EntityId; component: GrabbedComponent }[];
}> {}
