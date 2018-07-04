//@flow

import _ from 'lodash';
import moment from 'moment';
import type {SmpzInteractionModelType} from '../../journey/interactions/reducer';
import type {SmpzExperiencesModelType} from '../../journey/experiences/reducer';

export const getTimestampFromTimeframe = (item: mixed): number => {
    const timeframe = _.get(item, 'timeframe');
    let timestamp = _.get(item, 'timestamp', moment().valueOf());

    if (timeframe) {
        timestamp = moment(_.get(timeframe, 'actual.start', _.get(timeframe, 'planned.start'))).valueOf();
    }

    return timestamp;
};

export const interactionLinking = (
    interaction: SmpzInteractionModelType | SmpzExperiencesModelType
): SmpzInteractionModelType | SmpzExperiencesModelType => {
    let sequence;
    let variants;
    let choice;

    const linkItem = (interaction: SmpzInteractionModelType): string | SmpzInteractionModelType =>
        interaction.id ? interaction.id : interaction;

    if (interaction.sequence) {
        sequence = _.map(interaction.sequence, linkItem);
    }

    if (interaction.variants) {
        variants = _.map(interaction.variants, linkItem);
    }

    if (interaction.choice) {
        choice = _.map(interaction.choice, linkItem);
    }

    return _.assign({}, interaction, {
        sequence,
        variants,
        choice
    });
};