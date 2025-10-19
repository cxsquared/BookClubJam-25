import { query, System } from '@typeonce/ecs';
import { EnergyComponent } from '../components/energy.component';
import { GameEventMap, UserEnergyChanged } from '../events';
import { SystemTags } from './systems-tags';

const energyBarQuery = query({
    energyComponent: EnergyComponent,
});

export class EnergySystem extends System<SystemTags, GameEventMap>()<{}>('EnergySystem', {
    dependencies: ['SpacetimeDBEventSystem'],
    execute: ({ poll, world }) => {
        const energyBars = energyBarQuery(world);
        poll(UserEnergyChanged).forEach((event) => {
            energyBars.forEach((eb) => {
                eb.energyComponent.bar.progress = event.data.newEnergy;
            });
        });
    },
}) {}
