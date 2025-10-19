import { Component } from '@typeonce/ecs';
import { Package } from '../../module_bindings';

export class PackageComponent extends Component('PackageComponent')<{
    package: Package;
}> {}
