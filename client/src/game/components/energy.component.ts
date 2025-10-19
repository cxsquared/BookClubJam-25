import { Component } from '@typeonce/ecs';
import { ProgressBarUi } from '../../ui/bar.ui';

export class EnergyComponent extends Component('EnergyComponent')<{
    bar: ProgressBarUi;
}> {}
